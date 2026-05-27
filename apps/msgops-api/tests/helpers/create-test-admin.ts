import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserEntity } from '../../src/entities/users.entity';
import { UserCredentialsEntity } from '../../src/entities/user-credentials.entity';
import { RoleEntity } from '../../src/entities/role.entity';
import { ROLE_CODES } from '../../src/modules/authz/authz.constants';

export async function createTestAdmin(dataSource: DataSource, email: string, password: string): Promise<void> {
  const userRepo = dataSource.getRepository(UserEntity);
  const credRepo = dataSource.getRepository(UserCredentialsEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);

  const role = await roleRepo.findOneOrFail({ where: { code: ROLE_CODES.SUPER_ADMIN } });
  const user = await userRepo.save(
    userRepo.create({
      email: email.toLowerCase(),
      name: 'Test Admin',
      profile: '',
      providerId: `local|${uuidv4()}`,
      status: 'active',
      globalRoleId: role.id,
    } as Partial<UserEntity>),
  );
  await credRepo.save(credRepo.create({ userId: user.id, passwordHash: await bcrypt.hash(password, 12) }));
}
