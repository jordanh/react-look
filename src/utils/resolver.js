import cloneObject from './cloner';
import * as Validator from './validator';
import React from 'react';
import assign from 'object-assign';
import evaluateExpression from './evaluator';
import State from '../map/state';
import pseudoMap from '../map/pseudo';
import addRequiredEventListeners from './listener';

/**
 * Resolves styling for an element and returns the modified one.
 * @param {LookComponent} container - the outer React Component to determine state and props
 * @param {Object} element - current element that gets modified
 * @param {object} selectors - all selectors with styles, conditions and extra css classNames
 * @param {Object} childProps - information on child-indexes for index-sensitive pseudo-classes
 */
export default function resolveLook(container, element, selectors, childProps) {
	if (element && element.props) {
		let props = element.props;

		let children = [];

		//If there are more than one child, iterate over them
		if (props.children && props.children instanceof Array) {

			let typeMap = generateTypeMap(props.children);
			let indexMap = {};
			/**
			 * Recursively resolve look for child elements first
			 * Generate index-maps to resolve child-index-sensitive pseudo-classes
			 */
			props.children.forEach((child, index) => {

				//Provides information on child (type-sensitive) child indexes to resolve index-sensitive pseudo-classes
				generateIndexMap(children, indexMap);

				let childProps;

				//only resolve child if it actually is a valid react element and has a look property
				if (child.props.look && React.isValidElement(child)) {

					let type = getChildType(child);

					childProps = {
						'index': index,
						'length': props.children.length,
						'typeIndex': indexMap[type],
						'typeIndexLength': typeMap[type].length
					}
					children.push(resolveLook(container, child, selectors, childProps));
				} else {
					children.push(child);
				}
			});
		} else {
			//if it's only one child which is not a primitive type its look gets 
			if (typeof props.children != 'number' && typeof props.children != 'string' && props.children.props.hasOwnProperty('look')) {
				children = resolveLook(container, props.children, selectors);
			} else {
				children = props.children;
			}
		}

		let newProps = ({}, props);
		let newStyle = {};

		//TODO: add multiple look support, see #14
		if (props.hasOwnProperty('look') && selectors.hasOwnProperty(props.look)) {
			let styles = selectors[props.look];

			let key = element.key || element.ref || 'root';

			if (!State.has(container, key)) {
				State.add(container, key);
			} else {
				console.warn('You already got a root element. Please use a specific key or ref in order to achieve :hover, :active, :focus to work properly.');
			}

			addRequiredEventListeners(container, element, key, newProps);
			newStyle = resolveStyle(cloneObject(styles), newProps, container, element, key, childProps)
			delete props.look;
		}

		/**
		 *If there already are styles in props they get assigned
		 *NOTE: newStyles get overwritten since attached ones have higher prio
		 */
		if (props.style) {
			newStyle = assign(newStyle, props.style);
		}
		newProps.style = newStyle;

		return React.cloneElement(element, newProps, children);
	} else {
		return element;
	}
}

/**
 * Interates every condition and valuates the expressions
 * Also applies additional classNames if specified (This helps if you're using extern CSS-libraries)
 * This returns the final styles object
 * @param {Object} styles - object that stores all style information, style, advanced and css
 * @param {Object} newProps- props that get the new styles added 
 * @param {LookComponent} container - the outer React Component that wraps all elements
 * @param {Object} element - current element
 * @param {string} key - current element's unique key (default is 'root')
 * @param {Object} childProps - map with information on index/type of the current element
 */
function resolveStyle(styles, newProps, container, element, key, childProps) {
	let newStyle = styles.style;
	let state = container.state;

	if (styles.css) {
		resolveClassName(styles.css, newProps);
	}

	if (styles.condition) {
		let expr;
		for (expr in styles.condition) {
			if (evaluateExpression(expr, container, element, key, childProps)) {
				let resolvedStyle = resolveStyle(styles.condition[expr], newProps, container, element, key, childProps);
				newStyle = assign(newStyle, resolvedStyle);
			}
		}
	}
	return newStyle;
}

/*
 * Adds additional CSS classes to the className list
 * @param {string} css - a string containing (a) valid className(s)
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
function generateIndexMap(children, indexMap) {
	children.forEach((child, index) => {

		// use component displayName if child is a function (ES6 component)
		let type = getChildType(child);

		if (indexMap.hasOwnProperty(type)) {
			++indexMap[type];
		} else {
			indexMap[type] = 1;
		}
	});
	return indexMap;
}

/**
 * Iterate through all children and create a map with type/index information
 * @param {Array} children - an array of children
 */
function generateTypeMap(children) {
	let indexMap = {};
	return generateIndexMap(children, indexMap);
}


/**
 * Returns a childs type
 * If child is an ES6 class it returns the displayName
 * @param {Object} child - child which type gets identified
 */
function getChildType(child) {
	let type;
	if (child.type == 'function') {
		type = (child.type.hasOwnProperty('name') ? child.type.name : child.type);
	} else {
		type = child.type;
	}
	return type;
}