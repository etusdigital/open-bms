export class ContactsImportDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tag?: string;

  constructor(contactsImportDto: ContactsImportDto = {} as ContactsImportDto) {
    this.email = contactsImportDto.email;
    this.firstName = contactsImportDto.firstName;
    this.lastName = contactsImportDto.lastName;
    this.phone = contactsImportDto.phone;
    this.tag = contactsImportDto.tag;
  }
}
