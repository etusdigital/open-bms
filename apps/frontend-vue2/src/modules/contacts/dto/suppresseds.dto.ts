export class SuppressedsDto {
  id?: number;
  email?: string;
  unsubscribedAt?: Date;
  isBlocked?: boolean;
  blockedAt?: Date;

  constructor(suppressedsDto: SuppressedsDto = {} as SuppressedsDto) {
    this.id = suppressedsDto.id;
    this.email = suppressedsDto.email;
    this.unsubscribedAt = suppressedsDto.unsubscribedAt;
    this.isBlocked = suppressedsDto.isBlocked;
    this.blockedAt = suppressedsDto.blockedAt;
  }
}
