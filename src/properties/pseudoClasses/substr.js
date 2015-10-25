import { createElement } from 'react'
import getPseudoExpression from '../../utils/getPseudoExpression'

// Evaluates if a element contains a given string
export default (property, styles, customKey, {newProps}) => {
  let children = newProps.children

  if ( (typeof children === 'string' || typeof children === 'number') ) {
    let newChildren = []

    const matches = children.match(new RegExp(getPseudoExpression(property), 'g'))
    if (!matches) {
      return false
    }

    matches.forEach(match => {
      const [left, ...right] = children.split(match)
      newChildren.push(left)
      newChildren.push(createElement('span', {
        style: styles
      }, match))
      children = right.join(match)
    })

    newChildren.push(children)
    newProps.children = newChildren
  }
  return false
}
