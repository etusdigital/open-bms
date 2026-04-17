-- Migration 013: Renomear colunas da tabela senders
-- name → from_name, email → from_mail, reply_to_email → reply_to_mail
ALTER TABLE senders RENAME COLUMN name TO from_name;
ALTER TABLE senders RENAME COLUMN email TO from_mail;
ALTER TABLE senders RENAME COLUMN reply_to_email TO reply_to_mail;
