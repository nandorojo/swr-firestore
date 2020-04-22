# @nandorojo/swr-firestore

React hooks for Firestore, that you can actually use in production, on every screen.

## Installation

```sh
npm install @nandorojo/swr-firestore

# or yarn

yarn add @nandorojo/swr-firestore
```

## Set up

In the root of your app, **create an instance of Fuego** and pass it to the **FuegoProvider**.

If you're using `next.js`, this goes in your `pages/_app.js` file.

`App.js`

```jsx
import React from 'react'
import { Fuego, FuegoProvider } from '@nandorojo/swr-firestore'

const fuego = new Fuego({
  // your Firebase config object goes here
})

export default () => {
  return (
    <FuegoProvider fuego={fuego}>{/* Your app code here! */}</FuegoProvider>
  )
}
```

Make sure to create your `Fuego` instance outside of the component. The only argument `Fuego` takes is your firebase `config` variable.

## Usage

```js
import React from 'react'
import { useDocument } from '@nandorojo/fuego'

const user = { id: 'Fernando' }
export default () => {
  // get one document
  const { data: user } = useDocument(`users/${user.id}`)
  // get a collection
  const { data: userList } = useCollection('users')
  // subscribe
  const { data: user } = useDocument(`users/${user.id}`, { listen: true })

  // query a collection
  const { data: userList } = useCollection('users', {
    where: ['name', '==', 'fernando'],
    limit: 10,
    orderBy: ['age', 'desc'],
  })

  // ...render here
}
```

I'll add more docs soon. There are TypeScript suggestions for all the options already!

## License

MIT
