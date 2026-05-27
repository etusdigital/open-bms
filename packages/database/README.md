# @retention/database

TypeORM data source factories shared between apps. Builds the connection from
the standard `TYPEORM_*` and `DATABASE_*` env vars and exposes a typed `entities`
array.

## Usage

```ts
import { createDataSource } from '@retention/database';

const ds = await createDataSource();
const repo = ds.getRepository(ContactEntity);
```
