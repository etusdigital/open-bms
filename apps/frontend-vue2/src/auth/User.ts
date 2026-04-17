export class User {
  sub = '';
  names = '';
  name = '';
  nickname = '';
  picture = '';
  updatedAt = '';
  email = '';
  emailVerified = true;

  provider?: string;
  id?: string;

  givenName?: string;
  familyName?: string;
  locale?: string;
  [key: string]: string | boolean | undefined;

  constructor(auth0User: { [key: string]: string | boolean | undefined }) {
    if (!auth0User) {
      return;
    }
    for (const key of Object.keys(auth0User)) {
      this[key] = auth0User[key];
    }

    this.sub = auth0User.sub as string;
    this.provider = this.sub.split('|')[0];
    this.id = this.sub.split('|')[1];
  }
}
