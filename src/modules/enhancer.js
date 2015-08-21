import resolveLook from './resolver';
import {_Object, _Validator} from 'type-utils';
import assignStyles from 'assign-styles';
import extend from '../utils/extend';

/**
 * Applies your styles to a React Component
 * @param {Component} Component - a valid React component that gets styles applied
 * @param {Array|Object} additionalStyles - additional styles that are used to resolve looks
 * @param {Array|Function} additionalProcessors - additional processors that modify the styles
 */
export default function Look(Component, additionalStyles = {}, additionalProcessors = undefined) {
	class LookComponent extends Component {
		constructor() {
			super(...arguments);
			this.state = this.state ||  {};

			//resolve processors
			if (this.processors) {
				if (this.processors instanceof Function) {
					this.processors = this.processors();
				}
				//arrayify processors
				if (this.processors instanceof Array !== true) {
					this.processors = [this.processors];
				}
			}

			//add additional processors
			if (additionalProcessors && !this.processors) {
				this.processors = [];
			};

			if (additionalProcessors instanceof Array) {
				this.processors.push(...additionalProcessors);
			} else if (additionalProcessors instanceof Object) {
				this.processors.push(additionalProcessors);
			}

			//resolve mixins			
			if (this.mixins) {
				if (this.mixins instanceof Function) {
					this.mixins = this.mixins();
				}
			} else {
				this.mixins = {};
			}
			//Adds default extend-mixin support
			this.mixins.extend = extend;

			this._lastActive = [];
			this.state._look = new Map();
		}


		//Remove mouseup listener if component unmounts to keep listeners clean
		componentWillUnmount() {
			if (super.componentWillUnmount) {
				super.componentWillUnmount();
			}
			if (this._onMouseUp) {
				window.removeEventListener('mouseup', this._onMouseUp);
			}
		}

		//Similar to Radium, Look wraps the render function and resolves styles on its own
		render() {
			//resolve multiple styles by merging those
			if (additionalStyles instanceof Array) {
				this.styles = assignStyles(...additionalStyles);
			} else if (additionalStyles instanceof Object) {
				this.styles = additionalStyles;
			} else {
				console.warn('Additional styles need to be either a valid object or an array of valid objects.');
				console.warn('Look ignores the following additional styles: ', additionalStyles);
				this.styles = {};
			}

			//Merge component assigned styles with outer styles to 
			if (this.look && this.look instanceof Function) {
				this.styles = assignStyles(this.look(), this.styles);
				delete this.look;
			}

			//Resolve default style object if no outer selector is given
			if (this.styles[Object.keys(this.styles)[0]] instanceof Object !== true) {
				this.styles = {
					'_default': this.styles
				}
			}

			/**
			 * Only resolveLook if there are styles to resolve
			 * Otherwise just return super.render() which leads to no difference
			 */
			if (this.styles || !_Validator.isEmpty(this.styles)) {
				this._matchValues = _Object.assign({}, this.props, this.state);
				return resolveLook(this, super.render());
			} else {
				console.warn(Compoent + ' was enhanced with Look, but did not provide any styles.');
				console.warn('This might affect performance and rendering time.');
				return super.render();
			}
		}
	}

	//Taken from Radium, this adds the original component displayName again
	LookComponent.displayName = Component.displayName || Component.name || 'Component';

	return LookComponent;
}