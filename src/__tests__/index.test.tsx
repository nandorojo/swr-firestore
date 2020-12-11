import { Serializer } from '../helpers/serializer'
import { CollectionQueryType } from '../hooks'

it.todo('write a test')

interface User {
  id: string
  name: string
  age: number
  joinedAt: Date
}

describe('serializing collection query', () => {
  test('single where clause', () => {
    const query: CollectionQueryType<User> = {
      where: ['date', '>', new Date('2020-01-01')],
      orderBy: 'name',
      limit: 1,
    }

    const serialized = Serializer.serializeQuery(query)
    expect(serialized).toEqual(
      '{"where":["date",">","2020-01-01T00:00:00.000Z",{"type":"date"}],"orderBy":"name","limit":1}'
    )

    const deserialized = Serializer.deserializeQuery(serialized)
    expect(deserialized).toEqual({
      ...query,
      where: ['date', '>', new Date('2020-01-01'), { type: 'date' }],
    })
  })

  test('multiple where clauses', () => {
    const query: CollectionQueryType<User> = {
      where: [
        ['date', '>', new Date('2010-01-01')],
        ['date', '<', new Date('2020-01-01')],
        ['name', '==', 'Fernando'],
      ],
      orderBy: 'name',
      limit: 1,
    }

    const serialized = Serializer.serializeQuery(query)
    expect(serialized).toEqual(
      '{"where":[["date",">","2010-01-01T00:00:00.000Z",{"type":"date"}],["date","<","2020-01-01T00:00:00.000Z",{"type":"date"}],["name","==","Fernando"]],"orderBy":"name","limit":1}'
    )

    const deserialized = Serializer.deserializeQuery(serialized)
    expect(deserialized).toEqual({
      ...query,
      where: [
        ['date', '>', new Date('2010-01-01'), { type: 'date' }],
        ['date', '<', new Date('2020-01-01'), { type: 'date' }],
        ['name', '==', 'Fernando'],
      ],
    })
  })
})
