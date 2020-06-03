# SWR + Firestore

```js
const { data } = useDocument('users/fernando')
```

**It's that easy.**

🔥 This library provides the hooks you need for querying Firestore, that you can actually use in production, on every screen.

⚡️ It aims to be **the fastest way to use Firestore in a React app,** both from a developer experience and app performance perspective.

🍕 This library is built on top [useSWR](https://swr.now.sh), meaning you get all of its awesome benefits out-of-the-box.

You can now fetch, add, and mutate Firestore data with zero boilerplate.

## Features

- Shared state / cache between collection and document queries [(instead of Redux??)](#shared-global-state-between-documents-and-collections)
- Works with both **React** and **React Native**.
- Blazing fast
- `set`, `update`, and `add` update your global cache, instantly
- TypeScript-ready [(see docs)](#typescript-support)
- Realtime subscriptions [(example)](#simple-examples)
- Prevent memory leaks from Firestore subscriptions
- No more parsing `document.data()` from Firestore requests

...along with the features touted by Vercel's incredible [SWR](https://github.com/zeit/swr#introduction) library:

_"With SWR, components will get a stream of data updates constantly and automatically. Thus, the **UI will be always fast and reactive**."_

- Transport and protocol agnostic data fetching
- Fast page navigation
- Revalidation on focus
- Interval polling
- Request deduplication
- Local mutation
- Pagination
- TypeScript ready
- SSR support
- Suspense mode
- Minimal API

## Installation

```sh
yarn add @nandorojo/swr-firestore

# or
npm install @nandorojo/swr-firestore
```

Install firebase:
```sh
expo install firebase
```

## Set up

In the root of your app, **create an instance of Fuego** and pass it to the **FuegoProvider**.

If you're using `next.js`, this goes in your `pages/_app.js` file.

`App.js`

```jsx
import React from 'react'
import 'firebase/firestore'
import 'firebase/auth'
import { Fuego, FuegoProvider } from '@nandorojo/swr-firestore'

const firebaseConfig = {
  // put yours here
}

const fuego = new Fuego(firebaseConfig)

export default function App() {
  return (
    <FuegoProvider fuego={fuego}>{/* Your app code here! */}</FuegoProvider>
  )
}
```

Make sure to create your `Fuego` instance outside of the component. The only argument `Fuego` takes is your firebase `config` variable.

## Basic Usage

_Assuming you've already completed the setup..._

### Subscribe to a document

```js
import React from 'react'
import { useDocument } from '@nandorojo/swr-firestore'
import { Text } from 'react-native'

export default function User() {
  const user = { id: 'Fernando' }
  const { data, update, error } = useDocument(`users/${user.id}`, { listen: true })

  if (error) return <Text>Error!</Text>
  if (!data) return <Text>Loading...</Text>
  
  return <Text>Name: {user.name}</Text>
}
```

### Get a collection

```js
import React from 'react'
import { useCollection } from '@nandorojo/swr-firestore'
import { Text } from 'react-native'

export default function UserList() {
  const { data, update, error } = useCollection(`users`)

  if (error) return <Text>Error!</Text>
  if (!data) return <Text>Loading...</Text>
  
  return data.map(user => <Text key={user.id}>{user.name}</Text>)
}
```

`useDocument` accepts a document `path` as its first argument here. `useCollection` works similarly.

## Simple examples

### Query a users collection:

```typescript
const { data } = useCollection('users')
```

### Subscribe for real-time updates:

```typescript
const { data } = useDocument(`users/${user.id}`, { listen: true })
```

### Make a complex collection query:

```typescript
const { data } = useCollection('users', {
  where: ['name', '==', 'fernando'],
  limit: 10,
  orderBy: ['age', 'desc'],
  listen: true,
})
```

### Pass options from SWR to your document query:

```typescript
// pass SWR options
const { data } = useDocument('albums/nothing-was-the-same', {
  shouldRetryOnError: false,
  onSuccess: console.log,
  loadingTimeout: 2000,
})
```

### Pass options from SWR to your collection query:

```typescript
// pass SWR options
const { data } = useCollection(
  'albums',
  {
    listen: true,
    // you can pass multiple where conditions if you want
    where: [
      ['artist', '==', 'Drake'],
      ['year', '==', '2020'],
    ],
  },
  {
    shouldRetryOnError: false,
    onSuccess: console.log,
    loadingTimeout: 2000,
  }
)
```

### Add data to your collection:

```typescript
const { data, add } = useCollection('albums', {
  where: ['artist', '==', 'Drake'],
})

const onPress = () => {
  // calling this will automatically update your global cache & Firestore
  add({
    title: 'Dark Lane Demo Tapes',
    artist: 'Drake',
    year: '2020',
  })
}
```

### Set document data:

```typescript
const { data, set, update } = useDocument('albums/dark-lane-demo-tapes')

const onReleaseAlbum = () => {
  // calling this will automatically update your global cache & Firestore
  set(
    {
      released: true,
    },
    { merge: true }
  )

  // or you could call this:
  update({
    released: true,
  })
}
```

### Use dynamic fields in a request: 
If you pass `null` as the collection or document key, the request won't send.

Once the key is set to a string, the request will send.

**Get list of users who have you in their friends list**

```typescript
import { useDoormanUser } from 'react-doorman'

const { uid } = useDoormanUser()
const { data } = useCollection(uid ? 'users' : null, {
  where: ['friends', 'array-contains', uid]
})
```

**Get your favorite song**

```typescript
const me = { id: 'fernando' }

const { data: user } = useDocument<{ favoriteSong: string }>(`users/${me.id}`)

// only send the request once the user.favoriteSong exists!
const { data: song } = useDocument(user?.favoriteSong ? `songs/${user.favoriteSong}` : null)
```

### Paginate a collection: 

Video [here](https://imgur.com/a/o9AlI4N).

```typescript
import React from "react";
import { fuego, useCollection } from "@nandorojo/swr-firestore";

const collection = "dump";
const limit = 1;
const orderBy = "text";

export default function Paginate() {
  const { data, mutate } = useCollection<{ text: string }>(
    collection,
    {
      limit,
      orderBy,
    },
    {
      // this lets us update the local cache + paginate without interruptions
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      refreshInterval: 0,
    }
  );

  const paginate = async () => {
    if (!data?.length) return;

    const ref = fuego.db.collection(collection);

    // get the last document in our current query
    // ideally we could pass just a doc ID, but firestore requires the doc snapshot
    const startAfterDocument = await ref.doc(data[data.length - 1].id).get();

    // get more documents, after the most recent one we have
    const moreDocs = await ref
      .orderBy(orderBy)
      .startAfter(startAfterDocument)
      .limit(limit)
      .get()
      .then((d) => {
        const docs = [];
        d.docs.forEach((doc) => docs.push({ ...doc.data(), id: doc.id }));
        return docs;
      });

    // mutate our local cache, adding the docs we just added
    // set revalidate to false to prevent SWR from revalidating on its own
    mutate((state) => [...state, ...moreDocs], false);
  };

  return data ? (
    <div>
      {data.map(({ id, text }) => (
        <div key={id}>{text}</div>
      ))}
      <button onClick={paginate}>paginate</button>
    </div>
  ) : (
    <div>Loading...</div>
  );
}
```

## Query Documents

You'll rely on `useDocument` to query documents.

```js
import React from 'react'
import { useDocument } from '@nandorojo/swr-firestore'

const user = { id: 'Fernando' }
export default () => {
  const { data, error } = useDocument(`users/${user.id}`)
}
```

If you want to set up a listener (or, in Firestore-speak, `onSnapshot`) just set `listen` to `true`.

```js
const { data, error } = useDocument(`users/${user.id}`, { listen: true })
```

# API

## `useDocument(path, options)`

```js
const { data, set, update, error, isValidating, mutate } = useDocument(
  path,
  options
)
```

### Arguments

- **`path` required** The unique document path for your Firestore document.
  - `string` | `null`. If `null`, the request will not be sent. This is useful if you want to get a user document, but the user ID hasn't loaded yet, for instance.
  - This follows the same pattern as the `key` argument in `useSWR`. See the [SWR docs](https://github.com/zeit/swr#conditional-fetching) for more. Functions are not currently supported for this argument.
- `options` _(optional)_ A dictionary with added options for the query. Takes the folowing values:
  - `listen = false`: If `true`, sets up a listener for this document that updates whenever it changes.
  - You can also pass any of the [options available from `useSWR`](https://github.com/zeit/swr#options).

### Return values

Returns a dictionary with the following values:

- `set(data, SetOptions?)`: Extends the `firestore` document `set` function.
  - You can call this when you want to edit your document.
  - It also updates the local cache using SWR's `mutate`. This will prove highly convenient over the regular Firestore `set` function.
  - The second argument is the same as the second argument for [Firestore `set`](https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document).
- `update(data)`: Extends the Firestore document [`update` function](https://firebase.google.com/docs/firestore/manage-data/add-data#update-data).
  - It also updates the local cache using SWR's `mutate`. This will prove highly convenient over the regular `set` function.

The dictionary also includes the following [from `useSWR`](https://github.com/zeit/swr#return-values):

- `data`: data for the given key resolved by fetcher (or undefined if not loaded)
- `error`: error thrown by fetcher (or undefined)
- `isValidating`: if there's a request or revalidation loading
- `mutate(data?, shouldRevalidate?)`: function to mutate the cached data

## `useCollection(path, query, options)`

```js
const { data, add, error, isValidating, mutate } = useCollection(
  path,
  query,
  options
)
```

### Arguments

- **`path`** required string, path to collection.
- `query` optional dictionary with Firestore query details
- `options` SWR options [(see SWR docs)](https://github.com/zeit/swr#options)

#### `path`

**`path` required** The unique document path for your Firestore document.

- `string` | `null`. If `null`, the request will not be sent. This is useful if you want to get a user document, but the user ID hasn't loaded yet, for instance.
- This follows the same pattern as the `key` argument in `useSWR`. See the [SWR docs](https://github.com/zeit/swr#conditional-fetching) for more. Functions are not currently supported for this argument.

#### `query`

_(optional)_ Dictionary that accepts any of the following optional values:

- `listen = false`: if true, will set up a real-time listener that automatically updates.
- `limit`: number that limits the number of documents
- [`where`](#where): filter documents by certain conditions based on their fields
- [`orderBy`](#orderBy): sort documents by their fields
- `startAt`: number to start at
- `endAt`: number to end at
- `startAfter`: number to start after
- `endBefore`: number to end before

##### `where`

Can be an array, or an array of arrays.

Each array follows this outline: `['key', 'comparison-operator', 'value']`. This is pulled directly from Firestore's [where pattern](https://firebase.google.com/docs/firestore/query-data/queries#query_operators).

```js
// get all users whoses name are Fernando
useCollection('users', {
  where: ['name', '==', 'Fernando'],
})

// get all users whose names are Fernando & who are hungry
useCollection('users', {
  where: [
    ['name', '==', 'Fernando'],
    ['isHungry', '==', true],
  ],
})

// get all users whose friends array contains Fernando
useCollection('users', {
  where: ['friends', 'array-contains', 'Fernando'],
})
```

##### `orderBy`

Can be a string, array, or an array of arrays.

Each array follows this outline: `['key', 'desc' | 'asc']`. This is pulled directly from Firestore's [orderBy pattern](https://firebase.google.com/docs/firestore/query-data/order-limit-data).

```js
// get users, ordered by name
useCollection('users', {
  orderBy: 'name',
})

// get users, ordered by name in descending order
useCollection('users', {
  orderBy: ['name', 'desc'],
})

// get users, ordered by name in descending order & hunger in ascending order
useCollection('users', {
  orderBy: [
    ['name', 'desc'], //
    ['isHungry', 'asc'],
  ],
})
```

#### `options`

_(optional)_ A dictionary with added options for the request. See the [options available from SWR](https://github.com/zeit/swr#options).

### Return values

Returns a dictionary with the following values:

- `add(data)`: Extends the Firestore document [`add` function](https://firebase.google.com/docs/firestore/manage-data/add-data).
  - It also updates the local cache using SWR's `mutate`. This will prove highly convenient over the regular `set` function.

The returned dictionary also includes the following [from `useSWR`](https://github.com/zeit/swr#return-values):

- `data`: data for the given key resolved by fetcher (or undefined if not loaded)
- `error`: error thrown by fetcher (or undefined)
- `isValidating`: if there's a request or revalidation loading
- `mutate(data?, shouldRevalidate?)`: function to mutate the cached data

# Features

## TypeScript Support

Create a model for your `typescript` types, and pass it as a generic to `useDocument` or `useCollection`.

### useDocument

The `data` item will include your TypeScript model (or `null`), and will also include an `id` string, an `exists` boolean, and `hasPendingWrites` boolean.

```typescript
type User = {
  name: string
}

const { data } = useDocument<User>('users/fernando')

if (data) {
  const {
    id, // string
    name, // string
    exists, // boolean
    hasPendingWrites, // boolean
  } = data
}

const id = data?.id //  string | undefined
const name = data?.name // string | undefined
const exists = data?.exists // boolean | undefined
const hasPendingWrites = data?.hasPendingWrites // boolean | undefind
```

### useCollection

The `data` item will include your TypeScript model (or `null`), and will also include an `id` string.

```typescript
type User = {
  name: string
}

const { data } = useCollection<User>('users')

if (data) {
  data.forEach(({ id, name }) => {
    // ...
  })
}
```

## Shared global state between documents and collections

A great feature of this library is shared data between documents and collections. Until now, this could only be achieved with something like a verbose Redux set up.

So, what does this mean exactly?

Simply put, any documents pulled from a Firestore request will update the global cache.

**To make it clear, let's look at an example.**

Imagine you query a `user` document from Firestore:

```js
const { data } = useDocument('users/fernando')
```

And pretend that this document's `data` returns the following:

```json
{ "id": "fernando", "isHungry": false }
```

_Remember that `isHungry` is `false` here ^_

Now, let's say you query the `users` collection anywhere else in your app:

```js
const { data } = useCollection('users')
```

And pretend that this collection's `data` returns the following:

```json
[
  { "id": "fernando", "isHungry": true },
  {
    //...
  }
]
```

Whoa, `isHungry` is now true. But what happens to the original document query? Will we have stale data?

**Answer:** It will automatically re-render with the new data!

`swr-firestore` uses document `id` fields to sync any collection queries with existing document queries across your app.

That means that **if you somehow fetch the same document twice, the latest version will update everywhere.**

## License

MIT
