import { parseEventType } from './parse-event-type';
import {
  ExternalQueryStep,
  FieldsType,
  GenerateDepsV1,
  GenerateResult,
  SegmentDtoLike,
  TagLike,
  TIMES_OPERATORS,
  EQUALITY_OPERATORS,
} from './types';

// V1 segment query generator. Builds an `INSERT INTO segment_process` SQL
// statement and accumulates ClickHouse subqueries (against `events_logs_v2`)
// into `externalQuerySteps`. Behaviorally equivalent to the original
// `TagsService.generateSegmentQuery` — output SQL parses identically;
// trailing whitespace inside template literals may differ due to prettier
// normalisation on extraction.
//
// SECURITY WARNING: this builder interpolates `step.*` fields directly
// into SQL strings. It assumes inputs (segment `steps`) are validated
// upstream by the producer (msgops-api DTOs / Joi schema) and that the
// caller never passes untrusted input. Do NOT call this from any path
// that exposes segment construction to end-user-supplied JSON.
export function generateSegmentQueryV1(tag: TagLike, segmentDto: SegmentDtoLike, deps: GenerateDepsV1): GenerateResult {
  const timeZoneValue = deps.timeZone || 'UTC';
  const externalQuerySteps: ExternalQueryStep[] = [];
  let subQueys = 0;
  let endQuery = '';
  let query = `INSERT INTO segment_process (`;
  for (const steps of segmentDto.steps) {
    let isConditionalCard = false;
    let setConditionalStatus = 0;
    const tagsCard: any[] = [];

    for (const step of steps) {
      // `conditional_times_value` holds the comparison operator for the
      // `HAVING COUNT(...)` clauses below. Segments created before the UI
      // captured this field omit it entirely, which used to interpolate a
      // literal `undefined` into the SQL and crash the ClickHouse query
      // (EVO-1423). Default to `>=` ("happened at least N times") and
      // whitelist the operator so only known-safe tokens reach the SQL.
      const timesOperator = TIMES_OPERATORS.includes(step.conditional_times_value) ? step.conditional_times_value : '>=';
      // Companion count for the same `HAVING` clauses. `parseInt` yields
      // `NaN` if `custom_times_value` is missing — which would re-introduce
      // an invalid `HAVING COUNT(...) >= NaN` query at the unconditional
      // sites (`automation_state`). Fall back to 1 ("at least once").
      const parsedTimesCount = parseInt(step.custom_times_value, 10);
      const timesCount = Number.isFinite(parsedTimesCount) ? parsedTimesCount : 1;

      if (!isConditionalCard) {
        if (step.type === 'conditionalCard') {
          query += ` ${step.value}`;
        }
        query += ` ( SELECT ${tag.id}, ct.id FROM contacts ct
          #PUSH_JOIN_REPLACE#
          WHERE ct.account_id = ${tag.accountId} AND ct.is_active `;
        isConditionalCard = true;
        setConditionalStatus = 1;
      }
      if (step.type == 'tag') {
        tagsCard.push(step);
        continue;
      }

      if (setConditionalStatus == 1 && step.type != 'conditionalCard') {
        query += ` ${step?.conditional ? ` ${step.conditional}` : `AND`} ( `;
        setConditionalStatus = 2;
      } else {
        query += step?.conditional ? ` ${step.conditional}` : ``;
      }

      switch (step.type) {
        case 'interation':
          if (step.event_type === 'anyChannel') {
            const time = `(CURRENT_DATE AT TIME ZONE '${timeZoneValue}' - interval '${step.time} day')`;
            const joinContactsDevices = 'INNER JOIN contacts_devices ctd ON ctd.contact_id = ct.id AND ctd.account_id = ct.account_id';
            query = query.replace('#PUSH_JOIN_REPLACE#', joinContactsDevices);
            query += ` (ct.last_open_date >= ${time} OR ct.last_click_date >= ${time} OR ct.sms_last_click >= ${time}
                OR ct.whatsapp_last_open >= ${time} OR ct.whatsapp_last_click >= ${time} OR ctd.last_click_date >= ${time}) `;
            break;
          }
          if (step.event_type === 'page_view') {
            const subTableNamePageView = `table_segment_page_view${subQueys}_${tag.id}`;
            const valueFilter = step.page_view_filter === 'iLike' ? `'%${step.page_view_value}%'` : step.page_view_value;
            const conditionalPageView = step.conditional_interation === 'yes' ? 'IN' : 'NOT IN';
            let queryPageViewCH = `SELECT contact_id FROM events_logs_v2 WHERE event = 'page_view'
              AND account_id = ${tag.accountId}
              AND time_date > #REPLACE_TIME_${step.time}_EVENTS_LOGS#
              AND url ${step.page_view_filter} ${valueFilter}`;
            if (step.custom_times_value > 1) {
              queryPageViewCH += ` GROUP BY contact_id
                HAVING COUNT(contact_id) ${timesOperator} ${timesCount} `;
            }
            query += ` ct.id ${conditionalPageView} (select contact_id from ${subTableNamePageView})`;
            subQueys++;

            externalQuerySteps.push({
              tableName: subTableNamePageView,
              query: queryPageViewCH,
            });

            break;
          }

          if (step.message === 'any' && (!step.custom_times_value || parseInt(step.custom_times_value, 10) === 1)) {
            let eventFilter = `ct.${step.event}`;
            if (['web-push', 'mobile-push'].includes(step.event_type)) {
              const joinContactsDevices = 'INNER JOIN contacts_devices ctd ON ctd.contact_id = ct.id AND ctd.account_id = ct.account_id';
              query = query.replace('#PUSH_JOIN_REPLACE#', joinContactsDevices);
              eventFilter = `ctd.type = '${step.event_type}' AND ctd.${step.event}`;
            }
            let timeFilter = step.conditional_interation == 'yes' ? 'is not null' : 'is null';
            const hasValidTime = step.time != null && step.time !== '' && step.time !== 'all';
            if (hasValidTime) {
              timeFilter =
                step.conditional_interation == 'yes'
                  ? `> (CURRENT_DATE AT TIME ZONE '${timeZoneValue}' - interval '${step.time} day')`
                  : `< (CURRENT_DATE AT TIME ZONE '${timeZoneValue}' - interval '${step.time} day') OR ${eventFilter} is null`;
            }
            query += ` (${eventFilter} ${timeFilter})`;
          } else {
            const filterType = step.conditional_interation == 'yes' ? 'IN' : 'NOT IN';
            if (!step.custom_times_value || parseInt(step.custom_times_value, 10) === 1) {
              const subTableNameView = `table_segment_view${subQueys}_${tag.id}`;
              let queryPageView = `SELECT DISTINCT contact_id
                FROM events_logs_v2
                WHERE account_id = ${tag.accountId}
                AND event = '${parseEventType(step.event)}'
                ${step.message ? `AND message_id = ${step.message.id} ${step.conditional_interation != 'yes' ? 'AND contact_id IS NOT NULL' : ''}` : ''}`;
              if (step.time != 'all') {
                queryPageView += ` AND time_date >= #REPLACE_TIME_${step.time}_EVENTS_LOGS#`;
              }

              query += ` ct.id ${filterType} (select contact_id from ${subTableNameView})`;
              subQueys++;

              externalQuerySteps.push({
                tableName: subTableNameView,
                query: queryPageView,
              });
            } else {
              const subTableName = `table_segment${subQueys}_${tag.id}`;
              const clickhouseQuery = `SELECT contact_id FROM events_logs_v2 WHERE event = '${parseEventType(step.event)}'
                  AND account_id = ${tag.accountId}
                  AND time_date >= #REPLACE_TIME_${step.time}_EVENTS_LOGS#
                  ${step.message && step.message.id ? ` AND message_id = ${step.message.id} ` : ''}
                  ${step.event_type == 'email' ? ` AND message_type = 'email' ` : ''}
                  ${step.conditional_interation != 'yes' ? ' AND contact_id IS NOT NULL' : ''}
                  GROUP BY contact_id
                  HAVING COUNT(contact_id) ${timesOperator} ${timesCount}`;

              externalQuerySteps.push({
                tableName: subTableName,
                query: clickhouseQuery,
              });

              endQuery += ` DROP TABLE ${subTableName}; `;
              query += ` ct.id ${filterType} (select contact_id from ${subTableName})`;
              subQueys++;
            }
          }
          break;

        case 'custom_field': {
          let customFieldValue = step.custom_field_value;
          if (step.conditional_custom_field == 'iLike') {
            customFieldValue = `%${step.custom_field_value}%`;
          }
          query += ` ct.id IN ( SELECT contact_id from contacts_custom_fields
              WHERE account_id = ${tag.accountId} AND custom_field_id = ${step.custom_field_id}
              and ${FieldsType[`${step?.custom_field_type || 'text'}` as keyof typeof FieldsType]} ${step.conditional_custom_field} '${customFieldValue.toLowerCase()}'
            )`;
          break;
        }

        case 'user_field':
          if (step.user_field_key === 'created_at_date' || step.user_field_key === 'last_automation_date') {
            if (step.conditional_user_field === '-') {
              query += ` ct.${step.user_field_key} >= (CURRENT_DATE AT TIME ZONE '${timeZoneValue}' - interval '${step.user_field_value} day')`;
              break;
            }

            const date = new Date(step.user_field_value).toISOString();
            query += ` ${step.user_field_key} ${step.conditional_user_field} '${date}'`;
            break;
          }

          if (step.user_field_key === 'email_provider') {
            const providerOperator = EQUALITY_OPERATORS.includes(step.conditional_user_field) ? step.conditional_user_field : '=';
            query += ` ${step.user_field_key} ${providerOperator} '${step.user_field_value}'`;
            break;
          }

          if (step.user_field_key === 'is_email_deliverable') {
            if (step.conditional_user_field === 'true') {
              query += ` ct.is_valid AND ct.is_unsubscribed = false AND ct.has_bounced = false`;
              break;
            }

            if (step.conditional_user_field === 'false') {
              query += ` (ct.is_valid = false OR ct.is_unsubscribed = true OR ct.has_bounced = true)`;
              break;
            }
          }

          if (step.user_field_key === 'communication_channels') {
            query += ` ct.${step.user_field_value} = ${step.conditional_user_field}`;
            if (step.user_field_value === 'has_web_push') {
              const joinContactsDevices = 'INNER JOIN contacts_devices ctd on ctd.contact_id = ct.id AND ctd.account_id = ct.account_id';
              query = query.replace('#PUSH_JOIN_REPLACE#', joinContactsDevices);
            } else if (step.user_field_value === 'has_email') {
              query += segmentDto.addBounced ? '' : ' AND NOT ct.has_bounced ';
              query += segmentDto.addInvalid ? '' : ' AND ct.is_valid ';
              query += segmentDto.addUnsubscribed ? '' : ' AND NOT ct.is_unsubscribed';
            }
            break;
          }

          query += ` ${step.user_field_key} ${step.conditional_user_field} '${step.user_field_value.toLowerCase()}'`;

          break;
        case 'custom_event': {
          const subTableNameCustomEvent = `table_segment_custom_event${subQueys}_${tag.id}`;
          let queryCustomEvent = `SELECT contact_id
            FROM events_logs_v2
            WHERE account_id = ${tag.accountId}
            AND event = '${step?.event?.name || 0}'
            AND contact_id IS NOT NULL`;
          if (step.time_type == 'range') {
            queryCustomEvent += ` AND time_date BETWEEN '${step.custom_event_date}' AND '${step.custom_event_date_end}'`;
          } else if (step.time_type == 'date') {
            queryCustomEvent += ` AND time_date ${step.conditional_event_filter} '${step.custom_event_date}'`;
          } else {
            if (['current_week', 'last_week'].includes(step.time)) {
              queryCustomEvent += ` AND time_date BETWEEN #BETWEEN_REPLACE_${step.time},${step.conditional_week_day_filter}_EVENTS_LOGS#`;
            } else {
              queryCustomEvent += ` AND time_date ${step.conditional_event_filter} #REPLACE_TIME_${step.time}_EVENTS_LOGS#`;
            }
          }
          if (step.properties) {
            for (const property of step.properties) {
              queryCustomEvent += ` AND properties.'${property.property}' = '${property.value}'`;
            }
          }
          if (step.custom_times_value) {
            queryCustomEvent += ` GROUP BY contact_id
              HAVING COUNT(contact_id) ${timesOperator} ${timesCount} `;
          }

          query += ` ct.id ${step.conditional_event_type} (select contact_id from ${subTableNameCustomEvent})`;
          subQueys++;

          externalQuerySteps.push({
            tableName: subTableNameCustomEvent,
            query: queryCustomEvent,
          });

          break;
        }
        case 'automation_state':
          query += ` ct.id IN (SELECT contact_id
                FROM contacts_automations
                WHERE account_id = ${tag.accountId} `;

          if (step.time == 1) {
            query += `AND created_at_date = (CURRENT_DATE AT TIME ZONE '${timeZoneValue}' - interval '${step.time} day')::date`;
          } else {
            query += `AND created_at_date >= (CURRENT_DATE AT TIME ZONE '${timeZoneValue}' - interval '${step.time} day')`;
          }

          if (step.automation) {
            query += ` AND automation_id = ${step.automation.id}`;
          }
          if (step.event !== 'entered') {
            query += ` AND status = '${step.event}'`;
          }
          query += ` GROUP BY contact_id
            HAVING COUNT(contact_id) ${timesOperator} ${timesCount} `;
          query += `)`;
          break;
      }
    }
    query = query.replace('#PUSH_JOIN_REPLACE#', '');

    if (setConditionalStatus == 2) {
      query += ` )`;
    }

    for (const stepTag of tagsCard) {
      const conditional = stepTag.conditional_tag == 'in' ? ' INTERSECT ' : ' EXCEPT ';

      query += ` ${conditional} (
          SELECT ${tag.id}, contact_id from contacts_tags
            WHERE account_id = ${tag.accountId} AND is_active AND tag_id IN (${stepTag.tag_id})
         )`;
    }

    query += ` )`;
  }

  if (segmentDto.contactsLimit) {
    query += ` LIMIT ${segmentDto.contactsLimit} `;
  }

  query += ' );';

  if (endQuery) {
    query = `${query} ${endQuery}`;
  }

  return { query, externalQuerySteps: externalQuerySteps.length ? externalQuerySteps : null };
}
