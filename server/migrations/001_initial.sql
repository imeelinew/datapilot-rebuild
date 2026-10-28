CREATE TABLE roles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  status smallint NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(100) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  parent_id integer REFERENCES permissions(id) ON DELETE CASCADE,
  type varchar(30) NOT NULL,
  path varchar(200),
  icon varchar(100),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE role_permissions (
  role_id integer NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id integer NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username varchar(80) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email varchar(200),
  avatar text,
  status smallint NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  role_id integer NOT NULL REFERENCES roles(id),
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE captcha_challenges (
  id uuid PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dashboards (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title varchar(160) NOT NULL,
  description text,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public smallint NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  bg_theme varchar(10) NOT NULL DEFAULT 'light' CHECK (bg_theme IN ('light', 'dark')),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE datasources (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(120) NOT NULL,
  type varchar(50) NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status smallint NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  description text,
  created_by integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE charts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dashboard_id integer NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  datasource_id integer REFERENCES datasources(id) ON DELETE SET NULL,
  title varchar(160) NOT NULL,
  chart_type varchar(20) NOT NULL CHECK (chart_type IN ('line', 'bar', 'pie', 'scatter', 'table')),
  query_config jsonb NOT NULL,
  chart_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX charts_dashboard_idx ON charts(dashboard_id, sort_order, id);

CREATE TABLE ai_conversations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200),
  dashboard_id integer REFERENCES dashboards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_conversations_user_idx ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE ai_messages (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_messages_conversation_idx ON ai_messages(conversation_id, id);

CREATE TABLE avatars (
  id uuid PRIMARY KEY,
  filename varchar(255) NOT NULL,
  mime_type varchar(80) NOT NULL,
  data bytea NOT NULL,
  uploaded_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE,
  province varchar(80) NOT NULL,
  population integer NOT NULL CHECK (population >= 0),
  area numeric(12, 2) NOT NULL CHECK (area > 0),
  gdp numeric(16, 2),
  lng numeric(10, 6) NOT NULL,
  lat numeric(10, 6) NOT NULL,
  congestion_index numeric(5, 2) NOT NULL,
  aqi numeric(6, 2) NOT NULL,
  pm25 numeric(6, 2) NOT NULL,
  temperature numeric(5, 2) NOT NULL,
  avg_speed numeric(6, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE city_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city_id integer NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  event_type varchar(60) NOT NULL,
  severity varchar(20) NOT NULL,
  status varchar(20) NOT NULL,
  reported_at timestamptz NOT NULL
);

CREATE TABLE facilities (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city_id integer NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  type varchar(60) NOT NULL,
  count integer NOT NULL CHECK (count >= 0)
);

CREATE TABLE environment_observations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city_id integer NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  district varchar(100) NOT NULL,
  aqi numeric(6, 2) NOT NULL,
  pm25 numeric(6, 2) NOT NULL,
  pm10 numeric(6, 2) NOT NULL,
  temperature numeric(5, 2) NOT NULL,
  humidity numeric(5, 2) NOT NULL,
  noise numeric(5, 2) NOT NULL,
  weather varchar(40) NOT NULL,
  recorded_at timestamptz NOT NULL
);

CREATE TABLE traffic_segments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city_id integer NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  road_name varchar(120) NOT NULL,
  lng numeric(10, 6) NOT NULL,
  lat numeric(10, 6) NOT NULL,
  congestion_index numeric(5, 2) NOT NULL
);

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roles_updated_at BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dashboards_updated_at BEFORE UPDATE ON dashboards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER datasources_updated_at BEFORE UPDATE ON datasources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER charts_updated_at BEFORE UPDATE ON charts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
