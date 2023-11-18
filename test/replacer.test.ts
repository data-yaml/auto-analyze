// from https://stackoverflow.com/questions/38799371/json-template-engine-in-node-js

var template = [
  {
    type: 'foo',
    config: '{testValue}'
  },
  {
    type: 'bar',
    arrConfig: '{testDict}'
  }
]

const mapping: { [key: string]: any } = {
  testValue: 'value1',
  test2: 'value2',
  testDict: { test4: 'value4' },
  testArray: ['value5', 'value6']
}

const replacer = function (_key: string, val: any) {
  // if val is a string and matches the pattern {key}, replace it with the value of data[key]

  if (typeof val === 'string' && val.match(/^{(.+)}$/)) {
    const value: string = val.replace(/[{|}]/g, '')
    return mapping[value] || val
  }
  return val
}

describe('replacer', () => {
  it('should replace a string value with a mapped value', () => {
    const key = 'testValue'
    const value = 'value1'
    const input = `{${key}}`
    const expected = value
    const result = replacer('', input)
    expect(result).toEqual(expected)
  })

  it('should not replace a string value that does not match the pattern', () => {
    const input = 'testValue'
    const expected = input
    const result = replacer('', input)
    expect(result).toEqual(expected)
  })

  it('should not replace a non-string value', () => {
    const input = 123
    const expected = input
    const result = replacer('', input)
    expect(result).toEqual(expected)
  })

  it('should not replace a string value that does not have a matching key', () => {
    const input = '{nonExistentKey}'
    const expected = input
    const result = replacer('', input)
    expect(result).toEqual(expected)
  })
})
