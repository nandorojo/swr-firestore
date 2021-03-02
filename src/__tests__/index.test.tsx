import firebase from 'firebase'
import { CollectionQueryType } from 'src/types/Query'
import { Fuego } from '..'
import { Serializer } from '../helpers/serializer'

it.todo('write a test')

interface User {
  id: string
  name: string
  age: number
  joinedAt: Date
}

// This is only to be able to create document references, no querying is actually done
const fuego = new Fuego({
  projectId: '123',
})

describe('serializing collection query', () => {
  test('single where clause with date', () => {
    const query: CollectionQueryType<User> = {
      where: ['date', '>', new Date('2020-01-01')],
      orderBy: 'name',
      limit: 1,
    }

    const serialized = Serializer.serializeQuery(query, fuego)
    expect(serialized).toEqual(
      '{"where":["date",">","2020-01-01T00:00:00.000Z",{"type":"date"}],"orderBy":"name","limit":1}'
    )

    const deserialized = Serializer.deserializeQuery(serialized, fuego)
    expect(deserialized).toEqual({
      ...query,
      where: ['date', '>', new Date('2020-01-01'), { type: 'date' }],
    })
  })

  test('multiple where clauses with dates', () => {
    const query: CollectionQueryType<User> = {
      where: [
        ['date', '>', new Date('2010-01-01')],
        ['date', '<', new Date('2020-01-01')],
        ['name', '==', 'Fernando'],
      ],
      orderBy: 'name',
      limit: 1,
    }

    const serialized = Serializer.serializeQuery(query, fuego)
    expect(serialized).toEqual(
      '{"where":[["date",">","2010-01-01T00:00:00.000Z",{"type":"date"}],["date","<","2020-01-01T00:00:00.000Z",{"type":"date"}],["name","==","Fernando"]],"orderBy":"name","limit":1}'
    )

    const deserialized = Serializer.deserializeQuery(serialized, fuego)
    expect(deserialized).toEqual({
      ...query,
      where: [
        ['date', '>', new Date('2010-01-01'), { type: 'date' }],
        ['date', '<', new Date('2020-01-01'), { type: 'date' }],
        ['name', '==', 'Fernando'],
      ],
    })
  })

  test('single where clause with ref', () => {
    const query: CollectionQueryType<User> = {
      where: [
        'user',
        '==',
        firebase.firestore().doc('users/dqKiW6iFUyFmXN1aVBQ6'),
      ],
      orderBy: 'name',
      limit: 1,
    }

    const serialized = Serializer.serializeQuery(query, fuego)
    expect(serialized).toEqual(
      '{"where":["user","==","users/dqKiW6iFUyFmXN1aVBQ6",{"type":"ref"}],"orderBy":"name","limit":1}'
    )

    const deserialized = Serializer.deserializeQuery(serialized, fuego)
    expect(deserialized).toEqual({
      ...query,
      where: [
        'user',
        '==',
        firebase.firestore().doc('users/dqKiW6iFUyFmXN1aVBQ6'),
        { type: 'ref' },
      ],
    })
  })
})
