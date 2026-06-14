-- Add Russian name fields
ALTER TABLE products ADD COLUMN name_ru TEXT;
ALTER TABLE products ADD COLUMN description_ru TEXT;

ALTER TABLE categories ADD COLUMN name_ru TEXT;
