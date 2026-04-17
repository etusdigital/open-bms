export class UserDto {
  id?: number;
  name: string;
  email: string;
  profile?: string;
  password: string;
  userAccount?: any;
  status?: string;
  globalRole?: string;
  effectiveRole?: string;
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;

  constructor(userDto: UserDto = {} as UserDto) {
    this.id = userDto.id;
    this.name = userDto.name;
    this.email = userDto.email;
    this.profile = userDto.profile;
    this.password = userDto.password;
    this.userAccount = userDto.userAccount;
    this.status = userDto.status;
    this.globalRole = userDto.globalRole;
    this.effectiveRole = userDto.effectiveRole;
    this.permissions = userDto.permissions || [];
    this.createdAt = userDto.createdAt;
    this.updatedAt = userDto.updatedAt;
    this.deletedAt = userDto.deletedAt;
  }
}
