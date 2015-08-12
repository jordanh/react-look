import {_Object, _Validator} from 'type-utils';
import React from 'react';
import evaluateExpression from './evaluator';
import assign from 'assign-styles';
import State from '../class/State';
import {Sheet} from 'dynamic-style-sheets';
import * as Validator
from './validator';

/**
 * Resolves styling for an element and returns the modified one.
 * @param {LookComponent} Component - the outer React Component to determine state and props
 * @param {Object} element - current element that gets modified
 * @param {Object} childIndexMap - information on child-indexes for index-sensitive pseudo-classes
 */
export default function resolveLook(Component, element, childIndexMap) {
	if (element && element.props) {
		let props = element.props;

		let oldChildren = props.children;
		let newChildren = [];

		//If there are more than one child, iterate over them
		if (oldChildren) {
			if (oldChildren instanceof Array) {

				let typeMap = generateTypeMap(oldChildren);
				let indexMap = {};
				let childType, childIndex;
				/**
				 * Recursively resolve look for child elements first
				 * Generate index-maps to resolve child-index-sensitive pseudo classes
				 */
				oldChildren.forEach((child, index) => {
					//only resolve child if it actually is a valid react element
					if (child) {

						//Provides information on child (type-sensitive) child indexes to resolve index-sensitive pseudo-classes
						generateIndexMap(child, indexMap);

						childType = getChildType(child);
						childIndex = {
							'index': index + 1,
							'length': oldChildren.length,
							'typeIndex': indexMap[childType],
							'typeIndexLength': typeMap[childType]
						}
						newChildren.push(resolveLook(Component, child, childIndex));

					} else {
						/**
						 * This clears undefined childs as they would fail to render
						 * e.g. if you're trying to map {this.props.title} but it is not defined
						 * It also fires a warning so that you may remove them on your own
						 */
						if (child === undefined) {
							console.warn('There are children which are either undefined, empty or invalid React Elements: ', oldChidren);
							console.warn('Look removed 1 child while validating (look="' + props.look + '"): child ', child);
						} else {
							newChildren.push(child);
						}
					}
				});
			} else {
				newChildren = resolveLook(Component, oldChildren);
			}
		}

		let newProps = _Object.assign({}, props);
		let newStyles = {};

		if (props.hasOwnProperty('look')) {

			//Splits look to resolve multiple looks
			let looks = (props.look === true ? '_default' : props.look).split(' ');

			looks.forEach(look => {
				if (Component.styles.hasOwnProperty(look)) {
					assign(newStyles, resolveStyle(Component, element, Component.styles[look], newProps, newChildren, childIndexMap));
				}
			})
			delete props.look;
		}
		/**
		 *If there already are styles in props they get assigned
		 *NOTE: new styles get overwritten since attached ones have higher prio
		 */
		if (props.style) {
			assign(newStyles, props.style);
		}

		let sheet = new Sheet(newStyles);

		//Process all resolved styles at once
		if (Component.processors) {
			sheet.process(...Component.processors);
		}

		let styles = sheet.getSelectors();

		//resolving :before & :after pseudo elements
		if (styles.before || styles.after) {
			if (newChildren instanceof Array !== true) {
				newChildren = [newChildren];
			}
			if (styles.before) {
				newChildren.unshift(styles.before);
				delete styles.before;
			} else if (styles.after) {
				newChildren.push(styles.after);
				delete styles.after;
			}
		}
		newProps.style = styles;


		return React.cloneElement(element, newProps, newChildren);
	} else {
		return element;
	}
}

/**
 * Interates every condition and valuates the expressions
 * Also applies additional classNames if specified (This helps if you're using extern CSS-libraries)
 * This returns the final styles object
 * @param {LookComponent} Component - the outer React Component that wraps all elements
 * @param {Object} styles - current Look styles that get resolved
 * @param {Object} element - current element
 * @param {Object} newProps - props that get the new styles added 
 * @param {Object} childProps - map with information on index/type of the current element
 */
function resolveStyle(Component, element, styles, newProps, newChildren, childIndexMap) {
	let state = Component.state;
	let newStyle = {};

	//resolve additional classNames
	if (styles.hasOwnProperty('css')) {
		resolveClassName(styles.css, newProps);
		delete styles.css;
	}

	_Object.each(styles, (property, value) => {
		if (value instanceof Object) {
			if (!_Validator.isEmpty(value)) {
				if (evaluateExpression(Component, element, property, newProps, childIndexMap)) {
					let resolved = resolveStyle(Component, element, value, newProps, newChildren, childIndexMap);
					if (Validator.isPseudoElement(property)) {
						newStyle[property.indexOf('before') > -1 ? 'before' : 'after'] = addPseudoElement(resolved);
					} else {
						newStyle = assign(newStyle, resolved);
					}
				}
			}
		} else {
			newStyle[property] = value;
		}
	});
	return newStyle;
}


function addPseudoElement(styles) {
	let content =  '';
	if (styles.content) {
		content = styles.content;
		delete styles.content;
	}

	let children;
	if (content.indexOf('url(') > -1) {
		children = [createPseudoImage(content)];
	} else {
		children = content;
	}
	return React.createElement('span', {
		style: styles
	}, children);
}

function createPseudoImage(content) {
	return React.createElement('img', {
		src: content.split('url(')[1].substr(0, content.length - 5)
	});
}


/**
 * Adds additional CSS classes to the className list
 * @param {string} css - a string containing (a) valid className(s)
 * @param {Object} newProps - props that get the new className added 
 */
function resolveClassName(css, newProps) {
	if (!newProps.className) {
		newProps.className = css;
	} else {
		newProps.className += ' ' + css
	}
}

/**
 * Generates a index map with information on type/index of each child
 * This is needed to validate type-specific index-sensitive pseudo-classes
 * e.g. :last-type-of
 * @param {Array} children - an array of children
 * @pararam {Object} indexMap - an object which stores the information
 */
function generateIndexMap(child, indexMap) {

	// use component displayName if child is a function (ES6 component)
	let childType = getChildType(child);

	if (indexMap.hasOwnProperty(childType)) {
		++indexMap[childType];
	} else {
		indexMap[childType] = 1;
	}
	return indexMap;
}

/**
 * Iterate through all children and create a map with type/index information
 * @param {Array} children - an array of children
 */
function generateTypeMap(children) {
	let indexMap = {};
	children.forEach((child, index) => {
		generateIndexMap(child, indexMap);
	});
	return indexMap;
}


/**
 * Returns a childs type
 * If child is an ES6 class it returns the displayName
 * @param {Object} child - child which type gets identified
 */
function getChildType(child) {
	let childType;
	if (child.type instanceof Function) {
		childType = (child.type.hasOwnProperty('name') ? child.type.name : child.type);
	} else {
		childType = child.type;
	}
	return childType;
}