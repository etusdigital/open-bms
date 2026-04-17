export class ContactsHeadersDto {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  ip?: string;
  timezone?: string;
  whatsapp?: string;

  constructor(contactsHeadersDto: ContactsHeadersDto = {} as ContactsHeadersDto) {
    this.email = contactsHeadersDto.email;
    this.name = contactsHeadersDto.name;
    this.phone = contactsHeadersDto.phone;
    this.city = contactsHeadersDto.city;
    this.region = contactsHeadersDto.region;
    this.country = contactsHeadersDto.country;
    this.postal = contactsHeadersDto.postal;
    this.ip = contactsHeadersDto.ip;
    this.timezone = contactsHeadersDto.timezone;
    this.whatsapp = contactsHeadersDto.whatsapp;
  }
}
