use glossfile;
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (username)
);
ALTER TABLE `users`
  ADD COLUMN `storage_used_mb` DECIMAL(18,2) NOT NULL DEFAULT 0.00;
  ALTER TABLE users
  ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '0=kapalı, 1=aktif';
  ALTER TABLE users
ADD COLUMN last_ip VARCHAR(45) NULL AFTER email;




CREATE TABLE shared_files (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE ip_blacklist (
  id INT NOT NULL AUTO_INCREMENT,
  ip_address VARCHAR(45) NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
ALTER TABLE ip_blacklist
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
  COMMENT '0=pasif, 1=aktif';

CREATE TABLE mfa_secrets (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE file_encryption_info (
  id INT NOT NULL AUTO_INCREMENT,
  file_id INT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'AES-256',
  key_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (file_id),
  FOREIGN KEY (file_id) REFERENCES shared_files(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
); 
SHOW TABLES;
ALTER TABLE personal_files
ADD COLUMN is_encrypted TINYINT(1) NOT NULL DEFAULT 0
AFTER mime_type;



USE glossfile;

INSERT INTO users (username, email, password_hash)
VALUES (
  'nunu',
  'nunu@example.com',
  '$2b$10$Ec7/a5XpIJ9vtZZrM2nCSOlROrddH2poo5NjTK.PVXydELn7NtTaq'
);
SELECT id, username, email, is_admin FROM users;



DESCRIBE users;
use glossfile;
show tables;
SELECT * FROM users;
describe personal_files;
describe ip_blacklist;

UPDATE personal_files
SET is_encrypted = 0
WHERE is_encrypted IS NULL;
ALTER TABLE personal_files
MODIFY COLUMN is_encrypted TINYINT(1) NOT NULL DEFAULT 0;

select id, user_id, original_name, stored_name, size_bytes, mime_type, is_encrypted, created_at from personal_files;

ALTER TABLE users
ADD COLUMN public_key_pem TEXT NULL AFTER password_hash,
ADD COLUMN private_key_pem TEXT NULL AFTER public_key_pem;
DESCRIBE users;
SHOW COLUMNS FROM users LIKE '%key%';
ALTER TABLE users DROP COLUMN private_key_pem;

ALTER TABLE shared_files
ADD COLUMN wrapped_key_b64 TEXT NULL,
ADD COLUMN iv_b64 TEXT NULL, 
ADD COLUMN tag_b64 TEXT NULL;

describe shared_files;
describe file_encryption_info;
describe personal_files;
USE glossfile;

SHOW TABLES LIKE 'personal_files';
DESCRIBE personal_files;
SELECT COUNT(*) FROM personal_files;
ALTER TABLE users
ADD UNIQUE KEY uq_users_email (email);

alter table shared_files
add column file_id int null after id,
add column sender_user_id int null after file_id,
add column receiver_user_id int null after sender_user_id;

alter table shared_files
add constraint fk_dhared_files_file
foreign key (file_id) references personal_files(id)
on delete cascade on update cascade;

alter table shared_files
add constraint fk_dhared_files_sender
foreign key(sender_user_id) references users(id)
on delete cascade on update cascade;

alter table shared_files
add constraint fk_shared_files_receiver
foreign key (receiver_user_id) references users(id)
on delete cascade on update cascade;

describe shared_files;

alter table shared_files
modify filepath varchar(512) not null;

SELECT CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'glossfile'
  AND TABLE_NAME = 'shared_files'
  AND COLUMN_NAME = 'user_id'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
ALTER TABLE shared_files DROP FOREIGN KEY shared_files_ibfk_1;
ALTER TABLE shared_files DROP COLUMN user_id;
describe shared_files;

ALTER TABLE shared_files
  ADD CONSTRAINT fk_shared_sender FOREIGN KEY (sender_user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_shared_receiver FOREIGN KEY (receiver_user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_shared_file FOREIGN KEY (file_id) REFERENCES personal_files(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

SELECT id, email, CHAR_LENGTH(public_key_pem) AS key_len
FROM users
WHERE email = 'ALICI_EMAIL';
SHOW COLUMNS FROM users LIKE '%public%';
-- Replace 1 with a real user id
SELECT id, public_key_pem FROM users WHERE id = 1;

describe users;
select id, username, email, last_ip, password_hash, public_key_pem, created_at from users;

SHOW COLUMNS FROM users LIKE 'language';
SHOW COLUMNS FROM users LIKE 'notify%';

ALTER TABLE users
  ADD COLUMN language VARCHAR(10) DEFAULT 'tr-TR',
  ADD COLUMN notify_upload TINYINT(1) DEFAULT 1,
  ADD COLUMN notify_share  TINYINT(1) DEFAULT 1;
DESCRIBE users;

ALTER TABLE personal_files
  ADD COLUMN iv_b64 TEXT NULL,
  ADD COLUMN tag_b64 TEXT NULL,
  ADD COLUMN cipher_hash_b64 TEXT NULL;

CREATE TABLE IF NOT EXISTS file_keys (
  id INT NOT NULL AUTO_INCREMENT,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  wrapped_key_b64 TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_file_user (file_id, user_id)
);

ALTER TABLE shared_files
  ADD COLUMN sender_signature_b64 TEXT NULL,
  ADD COLUMN signed_payload_b64 TEXT NULL,
  ADD COLUMN cipher_hash_b64 TEXT NULL;

