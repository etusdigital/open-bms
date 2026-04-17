import { MigrationInterface, QueryRunner } from 'typeorm';

export class createRbacCore1771800000000 implements MigrationInterface {
  name = 'createRbacCore1771800000000';

  private roleSeeds = [
    { code: 'super_admin', name: 'Super Admin', description: 'Acesso total plataforma' },
    { code: 'admin', name: 'Admin', description: 'Acesso total na conta' },
    { code: 'editor', name: 'Editor', description: 'Operacao de engajamento' },
    { code: 'analyst', name: 'Analyst', description: 'Leitura ampla' },
    { code: 'support', name: 'Support', description: 'Gestao de contatos e suppressions' },
    { code: 'billing', name: 'Billing', description: 'Gestao de custos e invoices' },
  ];

  private rolePermissions: Record<string, string[]> = {
    super_admin: [
      'campaigns:view',
      'campaigns:create',
      'campaigns:create_from_rule',
      'campaigns:update',
      'campaigns:delete',
      'campaigns:send',
      'campaigns:schedule',
      'campaigns:pause',
      'campaigns:resume',
      'campaigns:cancel',
      'campaigns:duplicate',
      'automations:view',
      'automations:create',
      'automations:update',
      'automations:delete',
      'automations:activate',
      'automations:deactivate',
      'automations:test',
      'messages:view',
      'messages:create',
      'messages:update',
      'messages:delete',
      'messages:test_send',
      'audience:contacts_view',
      'audience:contacts_import',
      'audience:contacts_export',
      'audience:contacts_suppress',
      'audience:segments_view',
      'audience:segments_execute',
      'audience:tags_view',
      'audience:custom_fields_view',
      'infra:view',
      'infra:manage',
      'analytics:dashboard_view',
      'analytics:dashboard_export',
      'analytics:insights_view',
      'analytics:comparison_view',
      'account:settings_view',
      'account:settings_update',
      'account:users_view',
      'account:users_invite',
      'account:users_update_roles',
      'account:roles_view',
      'account:api_keys_view',
      'account:api_keys_create',
      'account:api_keys_rotate',
      'account:api_keys_revoke',
      'account:api_keys_update_role',
      'audit_logs:view',
      'audit_logs:export',
    ],
    admin: [
      'campaigns:view',
      'campaigns:create',
      'campaigns:create_from_rule',
      'campaigns:update',
      'campaigns:delete',
      'campaigns:send',
      'campaigns:schedule',
      'campaigns:pause',
      'campaigns:resume',
      'campaigns:cancel',
      'campaigns:duplicate',
      'automations:view',
      'automations:create',
      'automations:update',
      'automations:delete',
      'automations:activate',
      'automations:deactivate',
      'automations:test',
      'messages:view',
      'messages:create',
      'messages:update',
      'messages:delete',
      'messages:test_send',
      'audience:contacts_view',
      'audience:contacts_import',
      'audience:contacts_export',
      'audience:contacts_suppress',
      'audience:segments_view',
      'audience:segments_execute',
      'audience:tags_view',
      'audience:custom_fields_view',
      'infra:view',
      'infra:manage',
      'analytics:dashboard_view',
      'analytics:dashboard_export',
      'analytics:insights_view',
      'analytics:comparison_view',
      'account:settings_view',
      'account:settings_update',
      'account:users_view',
      'account:users_invite',
      'account:users_update_roles',
      'account:roles_view',
      'account:api_keys_view',
      'account:api_keys_create',
      'account:api_keys_rotate',
      'account:api_keys_revoke',
      'account:api_keys_update_role',
      'audit_logs:view',
      'audit_logs:export',
    ],
    editor: [
      'campaigns:view',
      'campaigns:create_from_rule',
      'campaigns:update',
      'campaigns:delete',
      'campaigns:send',
      'campaigns:schedule',
      'campaigns:pause',
      'campaigns:resume',
      'campaigns:cancel',
      'campaigns:duplicate',
      'automations:view',
      'automations:create',
      'automations:update',
      'automations:delete',
      'automations:activate',
      'automations:deactivate',
      'automations:test',
      'messages:view',
      'messages:create',
      'messages:update',
      'messages:delete',
      'messages:test_send',
      'audience:contacts_view',
      'audience:segments_view',
      'audience:tags_view',
      'audience:custom_fields_view',
      'analytics:dashboard_view',
      'analytics:insights_view',
      'analytics:comparison_view',
    ],
    analyst: [
      'campaigns:view',
      'automations:view',
      'messages:view',
      'audience:contacts_view',
      'audience:segments_view',
      'audience:tags_view',
      'audience:custom_fields_view',
      'infra:view',
      'analytics:dashboard_view',
      'analytics:insights_view',
      'analytics:comparison_view',
      'account:settings_view',
      'account:users_view',
      'account:roles_view',
    ],
    support: ['audience:contacts_view', 'audience:contacts_suppress', 'analytics:dashboard_view'],
    billing: [],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        code VARCHAR(80) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT NULL,
        is_system BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_roles_code') THEN
          ALTER TABLE roles ADD CONSTRAINT unique_roles_code UNIQUE (code);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT NOT NULL,
        permission_key VARCHAR(160) NOT NULL,
        effect VARCHAR(20) NOT NULL DEFAULT 'allow',
        PRIMARY KEY (role_id, permission_key)
      );
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_role_permissions_role_id') THEN
          ALTER TABLE role_permissions
          ADD CONSTRAINT fk_role_permissions_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    for (const role of this.roleSeeds) {
      await queryRunner.query(
        `
        INSERT INTO roles (code, name, description, is_system, is_active)
        VALUES ($1, $2, $3, true, true)
        ON CONFLICT (code) DO NOTHING;
      `,
        [role.code, role.name, role.description],
      );
    }

    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    `);

    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS global_role_id INT;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_global_role_id') THEN
          ALTER TABLE users
          ADD CONSTRAINT fk_users_global_role_id FOREIGN KEY (global_role_id) REFERENCES roles(id);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE users_accounts
      ADD COLUMN IF NOT EXISTS role_override_role_id INT NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_accounts_role_override_role_id') THEN
          ALTER TABLE users_accounts
          ADD CONSTRAINT fk_users_accounts_role_override_role_id FOREIGN KEY (role_override_role_id) REFERENCES roles(id);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE users u
      SET global_role_id = r.id
      FROM roles r
      WHERE r.code = 'admin'
      AND EXISTS (
        SELECT 1
        FROM users_accounts ua
        WHERE ua.user_id = u.id AND ua.is_master_user = true
      )
      AND (u.global_role_id IS NULL);
    `);

    await queryRunner.query(`
      UPDATE users u
      SET global_role_id = r.id
      FROM roles r
      WHERE r.code = 'editor'
      AND (u.global_role_id IS NULL);
    `);

    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN global_role_id SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounts_api_keys (
        id SERIAL PRIMARY KEY,
        account_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        key_hash VARCHAR(128) NOT NULL,
        role_id INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        expires_at TIMESTAMPTZ NULL,
        last_used_at TIMESTAMPTZ NULL,
        created_by_user_id INT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'managed',
        revoked_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_accounts_api_keys_hash') THEN
          ALTER TABLE accounts_api_keys ADD CONSTRAINT unique_accounts_api_keys_hash UNIQUE (key_hash);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_api_keys_account_id') THEN
          ALTER TABLE accounts_api_keys
          ADD CONSTRAINT fk_accounts_api_keys_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_api_keys_role_id') THEN
          ALTER TABLE accounts_api_keys
          ADD CONSTRAINT fk_accounts_api_keys_role_id FOREIGN KEY (role_id) REFERENCES roles(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_accounts_api_keys_created_by_user_id') THEN
          ALTER TABLE accounts_api_keys
          ADD CONSTRAINT fk_accounts_api_keys_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    for (const [roleCode, permissions] of Object.entries(this.rolePermissions)) {
      if (!permissions.length) {
        continue;
      }
      for (const permission of permissions) {
        await queryRunner.query(
          `
          INSERT INTO role_permissions (role_id, permission_key, effect)
          SELECT r.id, $2, 'allow'
          FROM roles r
          WHERE r.code = $1
          ON CONFLICT (role_id, permission_key) DO NOTHING;
        `,
          [roleCode, permission],
        );
      }
    }

    await queryRunner.query(`
      INSERT INTO accounts_api_keys (account_id, name, key_hash, role_id, status, source)
      SELECT ac.account_id, ac.name, md5(ac.value), r.id, 'active', 'legacy_import'
      FROM accounts_configs ac
      INNER JOIN roles r ON r.code = 'admin'
      WHERE ac.name IN ('api_key', 'api_key_tracker')
      ON CONFLICT (key_hash) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE accounts_api_keys DROP CONSTRAINT IF EXISTS fk_accounts_api_keys_created_by_user_id;`);
    await queryRunner.query(`ALTER TABLE accounts_api_keys DROP CONSTRAINT IF EXISTS fk_accounts_api_keys_role_id;`);
    await queryRunner.query(`ALTER TABLE accounts_api_keys DROP CONSTRAINT IF EXISTS fk_accounts_api_keys_account_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounts_api_keys;`);

    await queryRunner.query(`ALTER TABLE users_accounts DROP CONSTRAINT IF EXISTS fk_users_accounts_role_override_role_id;`);
    await queryRunner.query(`ALTER TABLE users_accounts DROP COLUMN IF EXISTS role_override_role_id;`);

    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_global_role_id;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS global_role_id;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS status;`);

    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles;`);
  }
}
