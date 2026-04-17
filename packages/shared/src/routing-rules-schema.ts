/**
 * JSON Schema AJV for RoutingRulesConfig.
 *
 * Usage in backend:
 *   import Ajv from 'ajv';
 *   import { ROUTING_RULES_SCHEMA } from '@retention/shared';
 *   const ajv = new Ajv({ removeAdditional: true });
 *   const validate = ajv.compile(ROUTING_RULES_SCHEMA);
 *
 * removeAdditional: true strips UI-only fields (isExpanded, children)
 * before persistence.
 */
export const ROUTING_RULES_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'RoutingRulesConfig',
  type: 'object',
  required: ['generalRule', 'exceptions', 'defaultConfig'],
  additionalProperties: false,
  properties: {
    generalRule: {
      type: 'array',
      items: { $ref: '#/definitions/Rule' },
    },
    exceptions: {
      type: 'array',
      items: { $ref: '#/definitions/ExceptionRule' },
    },
    defaultConfig: {
      oneOf: [
        { $ref: '#/definitions/DefaultConfig' },
        { type: 'null' },
      ],
    },
  },

  definitions: {
    Rule: {
      type: 'object',
      required: ['id', 'name', 'filters', 'distribution'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        filters: { $ref: '#/definitions/RuleFilters' },
        distribution: {
          type: 'array',
          items: { $ref: '#/definitions/Distribution' },
        },
      },
    },

    ExceptionRule: {
      type: 'object',
      required: ['id', 'name', 'filters', 'distribution', 'targetType', 'appliesTo', 'priority'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        filters: { $ref: '#/definitions/RuleFilters' },
        distribution: {
          type: 'array',
          items: { $ref: '#/definitions/Distribution' },
        },
        targetType: {
          type: 'string',
          enum: ['campaign', 'automation', 'segment', 'label', 'message'],
        },
        appliesTo: { $ref: '#/definitions/ExceptionTarget' },
        priority: { type: 'number' },
      },
    },

    RuleFilters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        provider: {
          type: 'string',
          enum: ['Gmail', 'Yahoo', 'Microsoft', 'iCloud', 'Other', 'all'],
        },
        type: {
          type: 'string',
          enum: ['campaign', 'journey', 'transactional', 'retargeting'],
        },
        userStatus: {
          type: 'string',
          enum: ['new', 'old'],
        },
        tags: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
        },
      },
    },

    Distribution: {
      type: 'object',
      required: ['accountId', 'percentage'],
      additionalProperties: false,
      properties: {
        accountId: { type: 'string', minLength: 1 },
        senderId: { type: 'string', minLength: 1 },
        percentage: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      },
    },

    ExceptionTarget: {
      type: 'object',
      additionalProperties: false,
      properties: {
        campaigns: {
          type: 'array',
          items: { $ref: '#/definitions/NamedItem' },
        },
        automations: {
          type: 'array',
          items: { $ref: '#/definitions/NamedItem' },
        },
        segments: {
          type: 'array',
          items: { $ref: '#/definitions/NamedItem' },
        },
        labels: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
        messages: {
          type: 'array',
          items: { $ref: '#/definitions/NamedItem' },
        },
      },
    },

    NamedItem: {
      type: 'object',
      required: ['id', 'name'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
      },
    },

    DefaultConfig: {
      type: 'object',
      required: ['accountId', 'senderId'],
      additionalProperties: false,
      properties: {
        accountId: { type: 'string', minLength: 1 },
        senderId: { type: 'string', minLength: 1 },
      },
    },
  },
} as const;
