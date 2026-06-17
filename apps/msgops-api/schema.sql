--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
-- Dumped by pg_dump version 16.3 (Homebrew)
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
--
-- Name: google_vacuum_mgmt; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA google_vacuum_mgmt;
--
-- Name: partman; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA partman;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it
--
-- Name: btree_gin; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public;
--
-- Name: EXTENSION btree_gin; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gin IS 'support for indexing common datatypes in GIN';
--
-- Name: google_vacuum_mgmt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS google_vacuum_mgmt WITH SCHEMA google_vacuum_mgmt;
--
-- Name: EXTENSION google_vacuum_mgmt; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION google_vacuum_mgmt IS 'extension for assistive operational tooling';
--
-- Name: pg_partman; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;
--
-- Name: EXTENSION pg_partman; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_partman IS 'Extension to manage partitioned tables by time or ID';
--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';
--
-- Name: postgres_fdw; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgres_fdw WITH SCHEMA public;
--
-- Name: EXTENSION postgres_fdw; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgres_fdw IS 'foreign-data wrapper for remote PostgreSQL servers';
--
-- Name: events_logs_bridge; Type: SERVER; Schema: -; Owner: -
--

CREATE SERVER events_logs_bridge FOREIGN DATA WRAPPER postgres_fdw OPTIONS (
  dbname 'msgops_events',
  fetch_size '10000',
  host 'events-logs.example.internal',
  port '5432'
);
--
-- User mappings for the events_logs_bridge FDW server.
-- Add one mapping per local role that needs to read the foreign tables:
--   CREATE USER MAPPING FOR <role> SERVER events_logs_bridge
--     OPTIONS (user '<remote_user>', password '<remote_password>');
SET default_tablespace = '';
SET default_table_access_method = heap;
--
-- Name: template_public_contacts; Type: TABLE; Schema: partman; Owner: -
--

CREATE TABLE partman.template_public_contacts (
  id integer NOT NULL,
  account_id integer NOT NULL,
  email character varying(255) NOT NULL,
  email_provider character varying(255) NOT NULL,
  first_name character varying(255) NOT NULL,
  last_name character varying(255),
  hashed_email character varying(255) NOT NULL,
  phone character varying(255),
  city character varying(255),
  region character varying(255),
  country character varying(255),
  postal character varying(255),
  ip character varying(50),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone character varying(100),
  is_active boolean NOT NULL,
  is_unsubscribed boolean NOT NULL,
  has_bounced boolean NOT NULL,
  last_open timestamp with time zone,
  last_click timestamp with time zone,
  last_sent timestamp with time zone,
  score integer,
  score_forecast integer,
  created_at timestamp with time zone NOT NULL,
  created_at_date date NOT NULL,
  updated_at timestamp with time zone,
  last_automation timestamp with time zone,
  uuid character varying(40)
);
--
-- Name: template_public_contacts_automations; Type: TABLE; Schema: partman; Owner: -
--

CREATE TABLE partman.template_public_contacts_automations (
  id integer NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  status character varying(255),
  automation_id integer,
  automation_title character varying(255),
  automation_type character varying(100),
  created_at timestamp with time zone NOT NULL,
  created_at_date date NOT NULL,
  updated_at timestamp with time zone
);
--
-- Name: template_public_contacts_custom_fields; Type: TABLE; Schema: partman; Owner: -
--

CREATE TABLE partman.template_public_contacts_custom_fields (
  contact_id integer NOT NULL,
  custom_field_id integer NOT NULL,
  value text NOT NULL,
  account_id integer NOT NULL
);
--
-- Name: template_public_contacts_devices; Type: TABLE; Schema: partman; Owner: -
--

CREATE TABLE partman.template_public_contacts_devices (
  id integer NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  type character varying(40) NOT NULL,
  is_active boolean NOT NULL,
  token character varying(255) NOT NULL,
  is_unsubscribed boolean NOT NULL,
  ip character varying(50),
  device_type character varying(60),
  os character varying(60),
  browser character varying(50),
  browser_version character varying(50),
  resolution character varying(50),
  subscription_url character varying(400),
  latest_visited_url character varying(400),
  last_session timestamp with time zone,
  last_sent timestamp with time zone,
  last_sent_date date,
  last_view timestamp with time zone,
  last_view_date date,
  last_click timestamp with time zone,
  last_click_date date,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone,
  last_delivered timestamp with time zone,
  last_delivered_date date
);
--
-- Name: template_public_contacts_tags; Type: TABLE; Schema: partman; Owner: -
--

CREATE TABLE partman.template_public_contacts_tags (
  contact_id integer NOT NULL,
  tag_id integer NOT NULL,
  account_id integer NOT NULL
);
--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
  id integer NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  settings json,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL
);
--
-- Name: accounts_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_configs (
  account_id integer NOT NULL,
  name character varying(255) NOT NULL,
  value text NOT NULL,
  description text,
  is_load_config boolean DEFAULT true NOT NULL
);
--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;
--
-- Name: accounts_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_usages (
  account_id integer NOT NULL,
  service character varying(255) NOT NULL,
  date date NOT NULL,
  count integer NOT NULL
);
--
-- Name: audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audits (
  id integer NOT NULL,
  account_id integer,
  entity character varying(255),
  entity_id integer NOT NULL,
  type character varying(255),
  old_values json,
  new_values json,
  "user" character varying(600),
  ip_address character varying(255),
  user_agent character varying(600),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone,
  deleted_at timestamp without time zone
);
--
-- Name: audits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audits_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audits_id_seq OWNED BY public.audits.id;
--
-- Name: automation_message_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_message_account (
  id integer NOT NULL,
  account_id integer,
  automation_message_id integer NOT NULL,
  test_id character varying(255) NOT NULL,
  provider_account_id character varying(255),
  provider character varying(20),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp without time zone,
  deleted_at timestamp without time zone
);
--
-- Name: automation_message_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automation_message_account_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: automation_message_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automation_message_account_id_seq OWNED BY public.automation_message_account.id;
--
-- Name: automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automations (
  id integer NOT NULL,
  account_id integer NOT NULL,
  title character varying(255) NOT NULL,
  name character varying(255),
  active boolean DEFAULT true NOT NULL,
  audience_id_external integer,
  audience_name character varying(255),
  message_id integer,
  type character varying(50) DEFAULT 'sunset'::character varying NOT NULL,
  version character varying(20) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  steps jsonb,
  triggers jsonb,
  step_id integer,
  count_steps integer,
  description text
);
--
-- Name: automations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automations_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: automations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automations_id_seq OWNED BY public.automations.id;
--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
  id integer NOT NULL,
  account_id integer NOT NULL,
  title character varying(255) NOT NULL,
  subject character varying(255),
  preview_text character varying(255),
  content text NOT NULL,
  content_json json,
  text text,
  from_mail character varying(255),
  from_name character varying(255),
  is_tested boolean DEFAULT false,
  message_id integer,
  ippool character varying(255),
  reply_to character varying(255),
  priority character varying(20) DEFAULT 'normal'::character varying,
  bucket_name character varying(255),
  file_name text,
  template_url character varying(350),
  version integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  type character varying(255),
  name character varying(255),
  image character varying(500),
  url character varying(500),
  description text,
  expiry_push_in_seconds integer,
  expiry_push_filter character varying(20),
  status character varying(50),
  whatsapp_type character varying(50),
  call_to_action_text character varying(100),
  provider_message_id character varying(100)
);
--
-- Name: automations_message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automations_message_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: automations_message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automations_message_id_seq OWNED BY public.messages.id;
--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
  id integer NOT NULL,
  account_id integer NOT NULL,
  title character varying(255) NOT NULL,
  name character varying(255) NOT NULL,
  publisher character varying(100) NOT NULL,
  schedule_to timestamp with time zone NOT NULL,
  schedule_to_cloud_task_id character varying(255),
  tags jsonb,
  status integer,
  spread_sending integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  sent_contacts integer,
  sent_percentage numeric,
  query text,
  steps jsonb,
  type character varying(30),
  testab_schedule_to timestamp with time zone,
  testab_schedule_end timestamp with time zone,
  testab_audience_percent integer,
  testab_criteria character varying(255),
  testab_sent_after_test boolean DEFAULT false NOT NULL,
  testab_schedule_to_cloud_task_id character varying(255),
  testab_schedule_end_cloud_task_id character varying(255),
  testab_last_id integer,
  message_type character varying(30),
  send_to_all boolean DEFAULT false,
  description text,
  recurrence_count integer DEFAULT 0,
  recurrence_settings jsonb,
  is_warmup boolean DEFAULT false NOT NULL
);
--
-- Name: campaigns_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns_contacts (
  campaign_id integer NOT NULL,
  contact_id integer NOT NULL
);
--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaigns_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;
--
-- Name: campaigns_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns_messages (
  campaign_id integer NOT NULL,
  message_id integer NOT NULL,
  statistics jsonb,
  winner boolean,
  result_date timestamp without time zone
);
--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
  id integer NOT NULL,
  account_id integer NOT NULL,
  email character varying(255),
  email_provider character varying(255),
  first_name character varying(255),
  last_name character varying(255),
  hashed_email character varying(255),
  phone character varying(255),
  city character varying(255),
  region character varying(255),
  country character varying(255),
  postal character varying(255),
  ip character varying(50),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone character varying(100),
  is_active boolean DEFAULT true NOT NULL,
  is_unsubscribed boolean DEFAULT false NOT NULL,
  has_bounced boolean DEFAULT false NOT NULL,
  last_open timestamp with time zone,
  last_click timestamp with time zone,
  last_sent timestamp with time zone,
  score integer,
  score_forecast integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone,
  last_automation timestamp with time zone,
  uuid character varying(40),
  is_valid boolean DEFAULT true NOT NULL,
  has_email boolean DEFAULT true NOT NULL,
  has_phone boolean DEFAULT false NOT NULL,
  has_web_push boolean DEFAULT false NOT NULL,
  has_mobile_push boolean DEFAULT false NOT NULL,
  last_open_date date,
  last_click_date date,
  last_sent_date date,
  last_automation_date date,
  whatsapp character varying(255),
  has_whatsapp boolean DEFAULT false NOT NULL,
  whatsapp_last_sent date,
  whatsapp_last_delivered date,
  whatsapp_last_open date,
  whatsapp_last_click date,
  sms_last_sent date,
  sms_last_delivered date,
  sms_last_click date,
  has_push_app boolean DEFAULT false
) PARTITION BY RANGE (account_id);
--
-- Name: contacts_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_automations (
  id integer NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  status character varying(255),
  automation_id integer,
  automation_title character varying(255),
  automation_type character varying(100),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone
) PARTITION BY RANGE (account_id);
--
-- Name: contacts_automations_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_automations_id_seq1 AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: contacts_automations_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contacts_automations_id_seq1 OWNED BY public.contacts_automations.id;
--
-- Name: contacts_automations_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_automations_default (
  id integer DEFAULT nextval('public.contacts_automations_id_seq1'::regclass) NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  status character varying(255),
  automation_id integer,
  automation_title character varying(255),
  automation_type character varying(100),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone
) WITH (autovacuum_enabled = 'false');
--
-- Name: contacts_custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_custom_fields (
  contact_id integer NOT NULL,
  custom_field_id integer NOT NULL,
  value text NOT NULL,
  account_id integer NOT NULL,
  "time" timestamp with time zone,
  number numeric,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone
) PARTITION BY RANGE (account_id);
--
-- Name: contacts_custom_fields_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_custom_fields_default (
  contact_id integer NOT NULL,
  custom_field_id integer NOT NULL,
  value text NOT NULL,
  account_id integer NOT NULL,
  "time" timestamp with time zone,
  number numeric,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone
) WITH (autovacuum_enabled = 'false');
--
-- Name: contacts_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_id_seq1 AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: contacts_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contacts_id_seq1 OWNED BY public.contacts.id;
--
-- Name: contacts_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_default (
  id integer DEFAULT nextval('public.contacts_id_seq1'::regclass) NOT NULL,
  account_id integer NOT NULL,
  email character varying(255),
  email_provider character varying(255),
  first_name character varying(255),
  last_name character varying(255),
  hashed_email character varying(255),
  phone character varying(255),
  city character varying(255),
  region character varying(255),
  country character varying(255),
  postal character varying(255),
  ip character varying(50),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone character varying(100),
  is_active boolean DEFAULT true NOT NULL,
  is_unsubscribed boolean DEFAULT false NOT NULL,
  has_bounced boolean DEFAULT false NOT NULL,
  last_open timestamp with time zone,
  last_click timestamp with time zone,
  last_sent timestamp with time zone,
  score integer,
  score_forecast integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone,
  last_automation timestamp with time zone,
  uuid character varying(40),
  is_valid boolean DEFAULT true NOT NULL,
  has_email boolean DEFAULT true NOT NULL,
  has_phone boolean DEFAULT false NOT NULL,
  has_web_push boolean DEFAULT false NOT NULL,
  has_mobile_push boolean DEFAULT false NOT NULL,
  last_open_date date,
  last_click_date date,
  last_sent_date date,
  last_automation_date date,
  whatsapp character varying(255),
  has_whatsapp boolean DEFAULT false NOT NULL,
  whatsapp_last_sent date,
  whatsapp_last_delivered date,
  whatsapp_last_open date,
  whatsapp_last_click date,
  sms_last_sent date,
  sms_last_delivered date,
  sms_last_click date,
  has_push_app boolean DEFAULT false
) WITH (autovacuum_enabled = 'false');
--
-- Name: contacts_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_devices_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: contacts_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_devices (
  id integer DEFAULT nextval('public.contacts_devices_id_seq'::regclass) NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  type character varying(40) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  token character varying(255) NOT NULL,
  is_unsubscribed boolean DEFAULT false NOT NULL,
  ip character varying(50),
  device_type character varying(60),
  os character varying(60),
  browser character varying(50),
  browser_version character varying(50),
  resolution character varying(50),
  subscription_url character varying(400),
  latest_visited_url character varying(400),
  last_session timestamp with time zone,
  last_sent timestamp with time zone,
  last_sent_date date,
  last_view timestamp with time zone,
  last_view_date date,
  last_click timestamp with time zone,
  last_click_date date,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone,
  last_delivered timestamp with time zone,
  last_delivered_date date
) PARTITION BY RANGE (account_id);
--
-- Name: contacts_devices_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_devices_default (
  id integer DEFAULT nextval('public.contacts_devices_id_seq'::regclass) NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  type character varying(40) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  token character varying(255) NOT NULL,
  is_unsubscribed boolean DEFAULT false NOT NULL,
  ip character varying(50),
  device_type character varying(60),
  os character varying(60),
  browser character varying(50),
  browser_version character varying(50),
  resolution character varying(50),
  subscription_url character varying(400),
  latest_visited_url character varying(400),
  last_session timestamp with time zone,
  last_sent timestamp with time zone,
  last_sent_date date,
  last_view timestamp with time zone,
  last_view_date date,
  last_click timestamp with time zone,
  last_click_date date,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone,
  last_delivered timestamp with time zone,
  last_delivered_date date
);
--
-- Name: contacts_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_tags (
  contact_id integer NOT NULL,
  tag_id integer NOT NULL,
  account_id integer NOT NULL,
  is_active boolean DEFAULT true
) PARTITION BY RANGE (account_id);
--
-- Name: contacts_tags_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts_tags_default (
  contact_id integer NOT NULL,
  tag_id integer NOT NULL,
  account_id integer NOT NULL,
  is_active boolean DEFAULT true
) WITH (autovacuum_enabled = 'false');
--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_fields (
  id integer NOT NULL,
  account_id integer NOT NULL,
  title character varying(255) NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  "order" integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  type character varying(50),
  attribution_type character varying(20),
  label character varying(255),
  placeholder character varying(255),
  field_format character varying(255),
  file_formats text [],
  character_limit integer,
  decimal_length integer,
  options text [],
  mask character varying(255),
  field_type character varying(20) DEFAULT 'text'::character varying
);
--
-- Name: custom_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custom_fields_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: custom_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custom_fields_id_seq OWNED BY public.custom_fields.id;
--
-- Name: email_validations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_validations (
  email character varying(255) NOT NULL,
  status character varying(50),
  reason character varying(255) NOT NULL,
  response text NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone
);
--
-- Name: emails_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emails_templates (
  id integer NOT NULL,
  account_id integer NOT NULL,
  name character varying(255) NOT NULL,
  html_template text,
  json_template text,
  image_template text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  description text
);
--
-- Name: emails_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emails_templates_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: emails_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emails_templates_id_seq OWNED BY public.emails_templates.id;
--
-- Name: events_logs; Type: FOREIGN TABLE; Schema: public; Owner: -
--

CREATE FOREIGN TABLE public.events_logs (
  "time" timestamp with time zone,
  date date,
  account_id integer,
  message_type character varying(40),
  event character varying(40),
  contact_id integer,
  automation_id integer,
  campaign_id integer,
  message_id integer,
  email character varying,
  utm_campaign character varying,
  provider character varying,
  is_test_ab boolean,
  reason character varying(255),
  url character varying(500),
  ip inet,
  events_logs_id bigint NOT NULL
) SERVER events_logs_bridge OPTIONS (
  schema_name 'public',
  table_name 'events_logs'
);
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN "time" OPTIONS (column_name 'time');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN date OPTIONS (column_name 'date');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN account_id OPTIONS (column_name 'account_id');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN message_type OPTIONS (column_name 'message_type');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN event OPTIONS (column_name 'event');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN contact_id OPTIONS (column_name 'contact_id');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN automation_id OPTIONS (column_name 'automation_id');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN campaign_id OPTIONS (column_name 'campaign_id');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN message_id OPTIONS (column_name 'message_id');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN email OPTIONS (column_name 'email');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN utm_campaign OPTIONS (column_name 'utm_campaign');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN provider OPTIONS (column_name 'provider');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN is_test_ab OPTIONS (column_name 'is_test_ab');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN reason OPTIONS (column_name 'reason');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN url OPTIONS (column_name 'url');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN ip OPTIONS (column_name 'ip');
ALTER FOREIGN TABLE public.events_logs
ALTER COLUMN events_logs_id OPTIONS (column_name 'events_logs_id');
--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
  id bigint NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  uuid character varying(255),
  transaction_id character varying(100),
  email character varying(255),
  hashed_email character varying(255),
  email_provider character varying(40),
  phone character varying(40),
  first_name character varying(255),
  last_name character varying(255),
  city character varying(255),
  region character varying(255),
  country character varying(255),
  ip character varying(50),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone character varying(100),
  clid text,
  ad_id text,
  adgroup_id text,
  adset_id text,
  placement text,
  campaign_id text,
  utm_source text,
  utm_medium text,
  utm_content text,
  utm_campaign text,
  utm_term text,
  utm_keyword text,
  questions jsonb,
  forms jsonb,
  query_string jsonb,
  is_valid boolean DEFAULT false NOT NULL,
  invalid_reason text,
  lead_source character varying(255),
  custom_fields jsonb,
  source_url text,
  direct_to_url text,
  user_agent text,
  engaged character varying(50),
  status character varying(255),
  tag_name character varying(255),
  automation_id integer,
  automation_title character varying(255),
  automation_status character varying(20),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone
);
--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;
--
-- Name: migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration (
  id integer NOT NULL,
  "timestamp" bigint NOT NULL,
  name character varying NOT NULL
);
--
-- Name: migration_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migration_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: migration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migration_id_seq OWNED BY public.migration.id;
--
-- Name: pools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pools (
  id integer NOT NULL,
  account_id integer NOT NULL,
  name character varying(255) NOT NULL,
  pool_name character varying(255),
  ip json,
  sending_limit character varying(255),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  sender_email character varying(255),
  sender_name character varying(60),
  sender_replyto_email character varying(255),
  is_default boolean DEFAULT false,
  description text,
  is_warmup boolean DEFAULT false NOT NULL
);
--
-- Name: pools_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pools_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: pools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pools_id_seq OWNED BY public.pools.id;
--
-- Name: postmaster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postmaster (
  "time" bigint NOT NULL,
  date date NOT NULL,
  domain character varying(255) NOT NULL,
  ip character varying(255),
  reputation character varying(20),
  domain_reputation character varying(20),
  user_reported_spam_ratio numeric,
  spf_success_ratio numeric,
  dkim_success_ratio numeric,
  dmarc_success_ratio numeric,
  inbound_encryption_ratio numeric,
  delivery_errors jsonb,
  spam_feedback_loops jsonb
);
--
-- Name: rfm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfm (
  email character varying(255) NOT NULL,
  datetime character varying(10) NOT NULL,
  domain character varying(50) NOT NULL,
  days_last_action integer,
  total_delivered integer,
  total_open integer,
  total_click integer,
  total_revenue double precision,
  recency double precision,
  frequency double precision,
  monetary double precision,
  r integer,
  f integer,
  m integer,
  rfm_score integer,
  cluster integer,
  account_id integer
);
--
-- Name: rfm30; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfm30 (
  email character varying(255),
  datetime character varying(10),
  domain character varying(50),
  days_last_action integer,
  total_delivered integer,
  total_open integer,
  total_click integer,
  total_revenue double precision,
  recency double precision,
  frequency double precision,
  monetary double precision,
  r integer,
  f integer,
  m integer,
  rfm_score integer,
  cluster integer,
  account_id integer
);
--
-- Name: short_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.short_links (
  short_code character varying(10) NOT NULL,
  long_url text NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
  id integer NOT NULL,
  account_id integer NOT NULL,
  name character varying(255) NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  description text,
  type character varying(255) DEFAULT 'tag'::character varying,
  recurrence integer,
  schedule_cloud_task_id character varying(255),
  query text,
  steps json,
  contacts_limit integer,
  segment_info jsonb,
  add_bounced boolean,
  add_unsubscribed boolean,
  add_invalid boolean,
  last_count integer,
  status character varying(20) DEFAULT 'active'::character varying,
  is_real_time_segment boolean DEFAULT false NOT NULL
);
--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;
--
-- Name: temporary_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_contacts (
  id integer NOT NULL,
  account_id integer NOT NULL,
  email character varying(255) NOT NULL,
  email_provider character varying(255) NOT NULL,
  first_name character varying(255) NOT NULL,
  last_name character varying(255),
  hashed_email character varying(255) NOT NULL,
  phone character varying(255),
  city character varying(255),
  region character varying(255),
  country character varying(255),
  postal character varying(255),
  ip character varying(50),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone character varying(100),
  is_active boolean DEFAULT true NOT NULL,
  is_unsubscribed boolean DEFAULT false NOT NULL,
  has_bounced boolean DEFAULT false NOT NULL,
  last_open timestamp with time zone,
  last_click timestamp with time zone,
  last_sent timestamp with time zone,
  score integer,
  score_forecast integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone,
  last_automation timestamp with time zone,
  uuid character varying(40),
  is_valid boolean DEFAULT false NOT NULL
);
--
-- Name: temporary_contacts_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_contacts_automations (
  id integer NOT NULL,
  account_id integer NOT NULL,
  contact_id integer NOT NULL,
  status character varying(255),
  automation_id integer,
  automation_title character varying(255),
  automation_type character varying(100),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at_date date DEFAULT CURRENT_DATE NOT NULL,
  updated_at timestamp with time zone
);
--
-- Name: temporary_contacts_automations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.temporary_contacts_automations_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: temporary_contacts_automations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.temporary_contacts_automations_id_seq OWNED BY public.temporary_contacts_automations.id;
--
-- Name: temporary_contacts_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_contacts_tags (
  contact_id integer NOT NULL,
  tag_id integer NOT NULL,
  account_id integer NOT NULL
);
--
-- Name: temporary_cost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_cost (
  name text,
  value double precision,
  margin integer
);
--
-- Name: typeorm_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.typeorm_metadata (
  type character varying NOT NULL,
  database character varying,
  schema character varying,
  "table" character varying,
  name character varying,
  value text
);
--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
  id integer DEFAULT nextval('public.users_id_seq'::regclass) NOT NULL,
  name character varying(255) NOT NULL,
  email character varying(255) NOT NULL,
  profile character varying(500) NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at timestamp with time zone,
  provider_id character varying(500),
  language character varying(20),
  settings json
);
--
-- Name: users_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_accounts (
  user_id integer NOT NULL,
  account_id integer NOT NULL,
  is_master_user boolean DEFAULT false
);
--
-- Name: warmup_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warmup_users (
  id integer NOT NULL,
  name character varying(255) NOT NULL,
  email character varying(255) NOT NULL,
  is_internal boolean DEFAULT false NOT NULL,
  slack_id character varying(60),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone
);
--
-- Name: warmup_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warmup_users_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: warmup_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warmup_users_id_seq OWNED BY public.warmup_users.id;
--
-- Name: warmups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warmups (
  id integer NOT NULL,
  account_id integer NOT NULL,
  sender character varying(255) NOT NULL,
  ippool character varying(255) NOT NULL,
  target integer NOT NULL,
  current_send integer NOT NULL,
  target_account_id integer NOT NULL,
  campaign_id integer NOT NULL,
  last_sent_at timestamp with time zone,
  status character varying(20) NOT NULL,
  warmup_info jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  type character varying(20),
  stage integer,
  remaining_send_today integer,
  reply_to character varying(255)
);
--
-- Name: warmups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warmups_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- Name: warmups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warmups_id_seq OWNED BY public.warmups.id;
--
-- Name: contacts_automations_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_automations ATTACH PARTITION public.contacts_automations_default DEFAULT;
--
-- Name: contacts_custom_fields_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_custom_fields ATTACH PARTITION public.contacts_custom_fields_default DEFAULT;
--
-- Name: contacts_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts ATTACH PARTITION public.contacts_default DEFAULT;
--
-- Name: contacts_devices_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_devices ATTACH PARTITION public.contacts_devices_default DEFAULT;
--
-- Name: contacts_tags_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_tags ATTACH PARTITION public.contacts_tags_default DEFAULT;
--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
ALTER COLUMN id
SET DEFAULT nextval('public.accounts_id_seq'::regclass);
--
-- Name: audits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
ALTER COLUMN id
SET DEFAULT nextval('public.audits_id_seq'::regclass);
--
-- Name: automation_message_account id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_message_account
ALTER COLUMN id
SET DEFAULT nextval(
    'public.automation_message_account_id_seq'::regclass
  );
--
-- Name: automations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
ALTER COLUMN id
SET DEFAULT nextval('public.automations_id_seq'::regclass);
--
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
ALTER COLUMN id
SET DEFAULT nextval('public.campaigns_id_seq'::regclass);
--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
ALTER COLUMN id
SET DEFAULT nextval('public.contacts_id_seq1'::regclass);
--
-- Name: contacts_automations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_automations
ALTER COLUMN id
SET DEFAULT nextval('public.contacts_automations_id_seq1'::regclass);
--
-- Name: custom_fields id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
ALTER COLUMN id
SET DEFAULT nextval('public.custom_fields_id_seq'::regclass);
--
-- Name: emails_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails_templates
ALTER COLUMN id
SET DEFAULT nextval('public.emails_templates_id_seq'::regclass);
--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
ALTER COLUMN id
SET DEFAULT nextval('public.leads_id_seq'::regclass);
--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
ALTER COLUMN id
SET DEFAULT nextval('public.automations_message_id_seq'::regclass);
--
-- Name: migration id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration
ALTER COLUMN id
SET DEFAULT nextval('public.migration_id_seq'::regclass);
--
-- Name: pools id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pools
ALTER COLUMN id
SET DEFAULT nextval('public.pools_id_seq'::regclass);
--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
ALTER COLUMN id
SET DEFAULT nextval('public.tags_id_seq'::regclass);
--
-- Name: temporary_contacts_automations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_contacts_automations
ALTER COLUMN id
SET DEFAULT nextval(
    'public.temporary_contacts_automations_id_seq'::regclass
  );
--
-- Name: warmup_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmup_users
ALTER COLUMN id
SET DEFAULT nextval('public.warmup_users_id_seq'::regclass);
--
-- Name: warmups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmups
ALTER COLUMN id
SET DEFAULT nextval('public.warmups_id_seq'::regclass);
--
-- Name: migration PK_3043fc6b8af7c99b8b98830094f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration
ADD CONSTRAINT "PK_3043fc6b8af7c99b8b98830094f" PRIMARY KEY (id);
--
-- Name: automation_message_account PK_30b6dd4913d436ccd7087822b90; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_message_account
ADD CONSTRAINT "PK_30b6dd4913d436ccd7087822b90" PRIMARY KEY (id);
--
-- Name: automations PK_34c2cc382fc780ea36f7c478192; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
ADD CONSTRAINT "PK_34c2cc382fc780ea36f7c478192" PRIMARY KEY (id);
--
-- Name: custom_fields PK_35ab958a0baec2e0b2b2b875fdb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
ADD CONSTRAINT "PK_35ab958a0baec2e0b2b2b875fdb" PRIMARY KEY (id);
--
-- Name: accounts PK_5a7a02c20412299d198e097a8fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
ADD CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY (id);
--
-- Name: pools PK_6708c86fc389259de3ee43230ee; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pools
ADD CONSTRAINT "PK_6708c86fc389259de3ee43230ee" PRIMARY KEY (id);
--
-- Name: campaigns PK_831e3fcd4fc45b4e4c3f57a9ee4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
ADD CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY (id);
--
-- Name: messages PK_8f7368cf17ef58765df5cc1c06d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
ADD CONSTRAINT "PK_8f7368cf17ef58765df5cc1c06d" PRIMARY KEY (id);
--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);
--
-- Name: warmups PK_b0efd67797dc516641b9f41b65f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmups
ADD CONSTRAINT "PK_b0efd67797dc516641b9f41b65f" PRIMARY KEY (id);
--
-- Name: audits PK_b2d7a2089999197dc7024820f28; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
ADD CONSTRAINT "PK_b2d7a2089999197dc7024820f28" PRIMARY KEY (id);
--
-- Name: leads PK_cd102ed7a9a4ca7d4d8bfeba406; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
ADD CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY (id);
--
-- Name: contacts_devices PK_contacts_devices; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_devices
ADD CONSTRAINT "PK_contacts_devices" PRIMARY KEY (account_id, id);
--
-- Name: emails_templates PK_e09aabd1440c23c1470c2a563ef; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails_templates
ADD CONSTRAINT "PK_e09aabd1440c23c1470c2a563ef" PRIMARY KEY (id);
--
-- Name: tags PK_e7dc17249a1148a1970748eda99; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
ADD CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY (id);
--
-- Name: campaigns_messages PK_eaf5059408853d1ba87024049b4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns_messages
ADD CONSTRAINT "PK_eaf5059408853d1ba87024049b4" PRIMARY KEY (campaign_id, message_id);
--
-- Name: email_validations UQ_27485e6aca206cacf66bbb8ca0a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_validations
ADD CONSTRAINT "UQ_27485e6aca206cacf66bbb8ca0a" UNIQUE (email);
--
-- Name: accounts UQ_2db43cdbf7bb862e577b5f540c8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
ADD CONSTRAINT "UQ_2db43cdbf7bb862e577b5f540c8" UNIQUE (name);
--
-- Name: short_links UQ_60004a8e08ed4e8a88af78e44c7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.short_links
ADD CONSTRAINT "UQ_60004a8e08ed4e8a88af78e44c7" UNIQUE (short_code);
--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);
--
-- Name: users UQ_e850707b5c70fa49ea50ef2f59f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
ADD CONSTRAINT "UQ_e850707b5c70fa49ea50ef2f59f" UNIQUE (profile);
--
-- Name: accounts_usages account_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_usages
ADD CONSTRAINT account_date_unique UNIQUE (account_id, date, service);
--
-- Name: accounts_configs accounts_configs_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_configs
ADD CONSTRAINT accounts_configs_unique UNIQUE (account_id, name);
--
-- Name: messages automations_message_title_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
ADD CONSTRAINT automations_message_title_unique UNIQUE (title, account_id, type);
--
-- Name: automations automations_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
ADD CONSTRAINT automations_name_unique UNIQUE (name, account_id);
--
-- Name: campaigns_contacts campaigns_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns_contacts
ADD CONSTRAINT campaigns_contacts_pkey PRIMARY KEY (campaign_id, contact_id);
--
-- Name: campaigns campaigns_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
ADD CONSTRAINT campaigns_name_unique UNIQUE (name, account_id);
--
-- Name: contacts_automations pk_0bb387f16d14c6d58664ae1e7bc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_automations
ADD CONSTRAINT pk_0bb387f16d14c6d58664ae1e7bc PRIMARY KEY (account_id, id);
--
-- Name: contacts_automations_default contacts_automations_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_automations_default
ADD CONSTRAINT contacts_automations_default_pkey PRIMARY KEY (account_id, id);
--
-- Name: contacts_custom_fields pk_contacts_custom_fields; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_custom_fields
ADD CONSTRAINT pk_contacts_custom_fields PRIMARY KEY (account_id, contact_id, custom_field_id, value);
--
-- Name: contacts_custom_fields_default contacts_custom_fields_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_custom_fields_default
ADD CONSTRAINT contacts_custom_fields_default_pkey PRIMARY KEY (account_id, contact_id, custom_field_id, value);
--
-- Name: contacts pk_b99cd40cfd66a99f1571f4f72e6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
ADD CONSTRAINT pk_b99cd40cfd66a99f1571f4f72e6 PRIMARY KEY (account_id, id);
--
-- Name: contacts_default contacts_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_default
ADD CONSTRAINT contacts_default_pkey PRIMARY KEY (account_id, id);
--
-- Name: contacts_devices_default contacts_devices_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts_devices_default
ADD CONSTRAINT contacts_devices_default_pkey PRIMARY KEY (account_id, id);
--
-- Name: warmup_users pk_ddf68ce65db41490623d11f6bb8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmup_users
ADD CONSTRAINT pk_ddf68ce65db41490623d11f6bb8 PRIMARY KEY (id);
--
-- Name: pools pools_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pools
ADD CONSTRAINT pools_name_unique UNIQUE (name, account_id);
--
-- Name: tags tag_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
ADD CONSTRAINT tag_name_unique UNIQUE (name, account_id);
--
-- Name: tags tag_unique_account_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
ADD CONSTRAINT tag_unique_account_id UNIQUE (account_id, id);
--
-- Name: warmup_users unique_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmup_users
ADD CONSTRAINT unique_email UNIQUE (email);
--
-- Name: users_accounts user_account_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_accounts
ADD CONSTRAINT user_account_unique UNIQUE (user_id, account_id);
--
-- Name: automation_message_id_automation_message_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_message_id_automation_message_account ON public.automation_message_account USING btree (automation_message_id);
--
-- Name: contact_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contact_email_unique ON ONLY public.contacts USING btree (account_id, email);
--
-- Name: idx_contacts_automations_composed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_automations_composed ON ONLY public.contacts_automations USING btree (account_id, contact_id, automation_id, status);
--
-- Name: contacts_automations_default_account_id_contact_id_automati_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_automations_default_account_id_contact_id_automati_idx ON public.contacts_automations_default USING btree (account_id, contact_id, automation_id, status);
--
-- Name: index_contacts_automations_created_at_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_automations_created_at_date ON ONLY public.contacts_automations USING btree (created_at_date);
--
-- Name: contacts_automations_default_created_at_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_automations_default_created_at_date_idx ON public.contacts_automations_default USING btree (created_at_date);
--
-- Name: index_contacts_automations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_automations_status ON ONLY public.contacts_automations USING btree (status);
--
-- Name: contacts_automations_default_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_automations_default_status_idx ON public.contacts_automations_default USING btree (status);
--
-- Name: idx_contacts_custom_fields_values; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_custom_fields_values ON ONLY public.contacts_custom_fields USING btree (account_id, custom_field_id, contact_id, value);
--
-- Name: contacts_custom_fields_defaul_account_id_custom_field_id_co_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_custom_fields_defaul_account_id_custom_field_id_co_idx ON public.contacts_custom_fields_default USING btree (account_id, custom_field_id, contact_id, value);
--
-- Name: idx_contacts_custom_fields_account_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_custom_fields_account_contact ON ONLY public.contacts_custom_fields USING btree (account_id, contact_id);
--
-- Name: contacts_custom_fields_default_account_id_contact_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_custom_fields_default_account_id_contact_id_idx ON public.contacts_custom_fields_default USING btree (account_id, contact_id);
--
-- Name: index_contacts_created_at_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_created_at_date ON ONLY public.contacts USING btree (account_id, created_at_date DESC);
--
-- Name: contacts_default_account_id_created_at_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_account_id_created_at_date_idx ON public.contacts_default USING btree (account_id, created_at_date DESC);
--
-- Name: contacts_default_account_id_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contacts_default_account_id_email_idx ON public.contacts_default USING btree (account_id, email);
--
-- Name: index_contacts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_is_active ON ONLY public.contacts USING btree (account_id, is_active);
--
-- Name: contacts_default_account_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_account_id_is_active_idx ON public.contacts_default USING btree (account_id, is_active);
--
-- Name: index_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_email ON ONLY public.contacts USING btree (email);
--
-- Name: contacts_default_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_email_idx ON public.contacts_default USING btree (email);
--
-- Name: index_gin_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_gin_contacts_email ON ONLY public.contacts USING gin (email public.gin_trgm_ops);
--
-- Name: contacts_default_email_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_email_idx1 ON public.contacts_default USING gin (email public.gin_trgm_ops);
--
-- Name: index_gin_contacts_first_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_gin_contacts_first_name ON ONLY public.contacts USING gin (first_name public.gin_trgm_ops);
--
-- Name: contacts_default_first_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_first_name_idx ON public.contacts_default USING gin (first_name public.gin_trgm_ops);
--
-- Name: index_contacts_hashed_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_hashed_email ON ONLY public.contacts USING btree (hashed_email);
--
-- Name: contacts_default_hashed_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_hashed_email_idx ON public.contacts_default USING btree (hashed_email);
--
-- Name: index_contacts_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_uuid ON ONLY public.contacts USING btree (uuid);
--
-- Name: contacts_default_uuid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_default_uuid_idx ON public.contacts_default USING btree (uuid);
--
-- Name: contacts_devices_idx_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_devices_idx_test ON ONLY public.contacts_devices USING btree (account_id, contact_id)
WHERE (is_active = true);
--
-- Name: contacts_devices_default_account_id_contact_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_devices_default_account_id_contact_id_idx ON public.contacts_devices_default USING btree (account_id, contact_id)
WHERE (is_active = true);
--
-- Name: contacts_devices_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contacts_devices_unique ON ONLY public.contacts_devices USING btree (account_id, contact_id, token);
--
-- Name: contacts_devices_default_account_id_contact_id_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contacts_devices_default_account_id_contact_id_token_idx ON public.contacts_devices_default USING btree (account_id, contact_id, token);
--
-- Name: index_contacts_tags_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_contacts_tags_primary ON ONLY public.contacts_tags USING btree (account_id, tag_id)
WHERE (is_active = true);
--
-- Name: contacts_tags_default_account_id_tag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_tags_default_account_id_tag_id_idx ON public.contacts_tags_default USING btree (account_id, tag_id)
WHERE (is_active = true);
--
-- Name: entity_id_audits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entity_id_audits ON public.audits USING btree (entity_id);
--
-- Name: idx_rfm_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfm_email ON public.rfm USING btree (email);
--
-- Name: idx_rfm_email_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfm_email_domain ON public.rfm USING btree (domain, email);
--
-- Name: index_accounts_usages_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_accounts_usages_account_id ON public.accounts_usages USING btree (account_id);
--
-- Name: index_accounts_usages_account_id_; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_accounts_usages_account_id_ ON public.accounts_usages USING btree (account_id, date);
--
-- Name: index_campaigns_contacts_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_contacts_campaign_id ON public.campaigns_contacts USING btree (campaign_id);
--
-- Name: index_campaigns_contacts_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_contacts_contact_id ON public.campaigns_contacts USING btree (contact_id);
--
-- Name: index_campaigns_messages_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_messages_campaign_id ON public.campaigns_messages USING btree (campaign_id);
--
-- Name: index_campaigns_messages_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_messages_message_id ON public.campaigns_messages USING btree (message_id);
--
-- Name: index_custom_fields_by_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_custom_fields_by_account ON public.custom_fields USING btree (account_id);
--
-- Name: index_custom_fields_name_by_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_custom_fields_name_by_account ON public.custom_fields USING btree (name, account_id);
--
-- Name: index_email_validations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_email_validations_email ON public.email_validations USING btree (email);
--
-- Name: index_leads_contact_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_leads_contact_status ON public.leads USING btree (account_id, status, automation_status);
--
-- Name: index_leads_created_at_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_leads_created_at_date ON public.leads USING btree (account_id, created_at_date);
--
-- Name: index_leads_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_leads_email ON public.leads USING btree (account_id, email);
--
-- Name: index_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_leads_status ON public.leads USING btree (account_id, status);
--
-- Name: index_short_links_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_short_links_code ON public.short_links USING btree (short_code);
--
-- Name: index_tag_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tag_name ON public.tags USING btree (name);
--
-- Name: index_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_user_email ON public.users USING btree (email);
--
-- Name: message_id_automations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_id_automations ON public.automations USING btree (message_id);
--
-- Name: contacts_automations_default_account_id_contact_id_automati_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_contacts_automations_composed ATTACH PARTITION public.contacts_automations_default_account_id_contact_id_automati_idx;
--
-- Name: contacts_automations_default_created_at_date_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_automations_created_at_date ATTACH PARTITION public.contacts_automations_default_created_at_date_idx;
--
-- Name: contacts_automations_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.pk_0bb387f16d14c6d58664ae1e7bc ATTACH PARTITION public.contacts_automations_default_pkey;
--
-- Name: contacts_automations_default_status_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_automations_status ATTACH PARTITION public.contacts_automations_default_status_idx;
--
-- Name: contacts_custom_fields_defaul_account_id_custom_field_id_co_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_contacts_custom_fields_values ATTACH PARTITION public.contacts_custom_fields_defaul_account_id_custom_field_id_co_idx;
--
-- Name: contacts_custom_fields_default_account_id_contact_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_contacts_custom_fields_account_contact ATTACH PARTITION public.contacts_custom_fields_default_account_id_contact_id_idx;
--
-- Name: contacts_custom_fields_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.pk_contacts_custom_fields ATTACH PARTITION public.contacts_custom_fields_default_pkey;
--
-- Name: contacts_default_account_id_created_at_date_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_created_at_date ATTACH PARTITION public.contacts_default_account_id_created_at_date_idx;
--
-- Name: contacts_default_account_id_email_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.contact_email_unique ATTACH PARTITION public.contacts_default_account_id_email_idx;
--
-- Name: contacts_default_account_id_is_active_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_is_active ATTACH PARTITION public.contacts_default_account_id_is_active_idx;
--
-- Name: contacts_default_email_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_email ATTACH PARTITION public.contacts_default_email_idx;
--
-- Name: contacts_default_email_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_gin_contacts_email ATTACH PARTITION public.contacts_default_email_idx1;
--
-- Name: contacts_default_first_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_gin_contacts_first_name ATTACH PARTITION public.contacts_default_first_name_idx;
--
-- Name: contacts_default_hashed_email_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_hashed_email ATTACH PARTITION public.contacts_default_hashed_email_idx;
--
-- Name: contacts_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.pk_b99cd40cfd66a99f1571f4f72e6 ATTACH PARTITION public.contacts_default_pkey;
--
-- Name: contacts_default_uuid_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_uuid ATTACH PARTITION public.contacts_default_uuid_idx;
--
-- Name: contacts_devices_default_account_id_contact_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.contacts_devices_idx_test ATTACH PARTITION public.contacts_devices_default_account_id_contact_id_idx;
--
-- Name: contacts_devices_default_account_id_contact_id_token_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.contacts_devices_unique ATTACH PARTITION public.contacts_devices_default_account_id_contact_id_token_idx;
--
-- Name: contacts_devices_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public."PK_contacts_devices" ATTACH PARTITION public.contacts_devices_default_pkey;
--
-- Name: contacts_tags_default_account_id_tag_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_contacts_tags_primary ATTACH PARTITION public.contacts_tags_default_account_id_tag_id_idx;
--
-- Name: automations FK_27e20a02b5bbadc271409d191bf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
ADD CONSTRAINT "FK_27e20a02b5bbadc271409d191bf" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: emails_templates FK_2e93564db71fd773447fb8fb52c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails_templates
ADD CONSTRAINT "FK_2e93564db71fd773447fb8fb52c" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: leads FK_3728102565dda29554f1661657c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
ADD CONSTRAINT "FK_3728102565dda29554f1661657c" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: warmups FK_37b03827c5f044b5de6b55e8fec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmups
ADD CONSTRAINT "FK_37b03827c5f044b5de6b55e8fec" FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
--
-- Name: warmups FK_3e5292e3d4d648dca80454897c8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmups
ADD CONSTRAINT "FK_3e5292e3d4d648dca80454897c8" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: leads FK_40068297e98ba1fa2bb56de8098; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
ADD CONSTRAINT "FK_40068297e98ba1fa2bb56de8098" FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE
SET NULL;
--
-- Name: users_accounts FK_4e9c647a0544af036456e1d139d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_accounts
ADD CONSTRAINT "FK_4e9c647a0544af036456e1d139d" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: audits FK_66742a7511667d6eb69f6e08526; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
ADD CONSTRAINT "FK_66742a7511667d6eb69f6e08526" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: campaigns FK_6fca73bc027c168f88c54e2f112; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
ADD CONSTRAINT "FK_6fca73bc027c168f88c54e2f112" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: accounts_configs FK_78531d86e488cdcbed24b8dba53; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_configs
ADD CONSTRAINT "FK_78531d86e488cdcbed24b8dba53" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: tags FK_7bddbde5bd5e1804c4bc638a4e3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
ADD CONSTRAINT "FK_7bddbde5bd5e1804c4bc638a4e3" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: users_accounts FK_7fd8bd853db80b87a963e871ee3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_accounts
ADD CONSTRAINT "FK_7fd8bd853db80b87a963e871ee3" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
--
-- Name: contacts FK_85bbf0f254d76347a346a8cbb15; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts
ADD CONSTRAINT "FK_85bbf0f254d76347a346a8cbb15" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: automations FK_8f7368cf17ef58765df5cc1c06d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
ADD CONSTRAINT "FK_8f7368cf17ef58765df5cc1c06d" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
--
-- Name: warmups FK_953bd5faec2a87482fbb6b745f4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warmups
ADD CONSTRAINT "FK_953bd5faec2a87482fbb6b745f4" FOREIGN KEY (target_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: messages FK_9796aa10735e52577f57a13f694; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
ADD CONSTRAINT "FK_9796aa10735e52577f57a13f694" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: custom_fields FK_99642bfea1e84b214ec43eed854; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_fields
ADD CONSTRAINT "FK_99642bfea1e84b214ec43eed854" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: campaigns_messages FK_a7746ad65bef5e4e1111ae6ede5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns_messages
ADD CONSTRAINT "FK_a7746ad65bef5e4e1111ae6ede5" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
--
-- Name: contacts_devices FK_c0dd29891305e2a0efaf7ffc17d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_devices
ADD CONSTRAINT "FK_c0dd29891305e2a0efaf7ffc17d" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: automation_message_account FK_c683cd49fd5624b5724fcf4be76; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_message_account
ADD CONSTRAINT "FK_c683cd49fd5624b5724fcf4be76" FOREIGN KEY (automation_message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
--
-- Name: pools FK_eb86d506aed80ec7e331ea85f3f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pools
ADD CONSTRAINT "FK_eb86d506aed80ec7e331ea85f3f" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: campaigns_messages campaigns_messages_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns_messages
ADD CONSTRAINT campaigns_messages_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
--
-- Name: contacts_tags fk_3ec2eb55a2d591c7d4ea3349add; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_tags
ADD CONSTRAINT fk_3ec2eb55a2d591c7d4ea3349add FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
--
-- Name: contacts_tags fk_48c3bbfaa2eb032ad7a7fc08404; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_tags
ADD CONSTRAINT fk_48c3bbfaa2eb032ad7a7fc08404 FOREIGN KEY (account_id, tag_id) REFERENCES public.tags(account_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
--
-- Name: contacts_automations fk_5675d5515ff362d58be6ccbf494; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_automations
ADD CONSTRAINT fk_5675d5515ff362d58be6ccbf494 FOREIGN KEY (automation_id) REFERENCES public.automations(id) ON DELETE CASCADE;
--
-- Name: contacts_automations fk_75eca282ee441a064c0a8372445; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_automations
ADD CONSTRAINT fk_75eca282ee441a064c0a8372445 FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: contacts_custom_fields fk_76388da8ec2eff18836ed0a6023; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_custom_fields
ADD CONSTRAINT fk_76388da8ec2eff18836ed0a6023 FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
--
-- Name: contacts_custom_fields fk_f32d23c0dceb4bb00d10c79cdc8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.contacts_custom_fields
ADD CONSTRAINT fk_f32d23c0dceb4bb00d10c79cdc8 FOREIGN KEY (custom_field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE;
--
-- PostgreSQL database dump complete
- -
