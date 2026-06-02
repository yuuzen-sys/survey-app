-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (事務局員)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surveys table (調査セッション)
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey members (調査員)
CREATE TABLE survey_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shops (店舗)
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  assigned_member_id UUID REFERENCES survey_members(id),
  color TEXT DEFAULT '#ff6b6b',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scenarios (シナリオ)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cautions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Checklist items (チェック項目)
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_order INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Checklist choices (選択肢)
CREATE TABLE checklist_choices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  choice_order INT NOT NULL
);

-- Survey reports (調査報告)
CREATE TYPE report_status AS ENUM ('submitted', 'checked');

CREATE TABLE survey_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES survey_members(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  responses JSONB NOT NULL,
  status report_status DEFAULT 'submitted',
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transportation reports (交通費報告)
CREATE TABLE transportation_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES survey_members(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_surveys_week ON surveys(week);
CREATE INDEX idx_survey_members_survey_id ON survey_members(survey_id);
CREATE INDEX idx_survey_members_token ON survey_members(token);
CREATE INDEX idx_shops_survey_id ON shops(survey_id);
CREATE INDEX idx_scenarios_shop_id ON scenarios(shop_id);
CREATE INDEX idx_checklist_items_scenario_id ON checklist_items(scenario_id);
CREATE INDEX idx_survey_reports_survey_id ON survey_reports(survey_id);
CREATE INDEX idx_survey_reports_member_id ON survey_reports(member_id);
CREATE INDEX idx_survey_reports_shop_id ON survey_reports(shop_id);
CREATE INDEX idx_transportation_reports_survey_id ON transportation_reports(survey_id);
