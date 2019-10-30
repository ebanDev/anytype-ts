import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Icon, IconUser, Input } from 'ts/component';
import { I } from 'ts/lib';
import { observer, inject } from 'mobx-react';

const $ = require('jquery');

interface Props extends I.Menu {
	commonStore?: any;
};
interface State {
	items: any[];
	filter: string;
};

@inject('commonStore')
@observer
class MenuAccount extends React.Component<Props, State> {
	
	filterRef: any = null;
	state = {
		items: [] as any[],
		filter: ''
	};
	
	constructor (props: any) {
		super(props);
		
		this.onKeyUp = this.onKeyUp.bind(this);
		this.onSubmit = this.onSubmit.bind(this);
	};
	
	render () {
		const { param } = this.props;
		const { items, filter } = this.state;
		
		let regExp = new RegExp(filter, 'i');
		let filtered = items.filter((item: any) => { return filter ? item.name.match(regExp) : true; });
		
		const Item = (item: any) => (
			<div className="item" onClick={(e: any) => { this.onSelect(e, item.id); }}>
				<IconUser className="c18" {...item} />
				{item.name}
			</div>
		);
		
		return (
			<div>
				<form className="form" onSubmit={this.onSubmit}>
					<Input ref={(ref: any) => { this.filterRef = ref; }} onKeyUp={this.onKeyUp} placeHolder="Find a person..." />
				</form>
				<div className="line" />
				<div className="items">
					{filtered.map((item: any, i: number) => (
						<Item key={i} {...item} id={i} index={i} />
					))}
				</div>
			</div>
		);
	};
	
	componentDidMount () {
		const { param } = this.props;
		const { data } = param;
		const { values } = data;
		
		this.setState({ items: values });
		this.filterRef.focus();
	};
	
	onSelect (e: any, id: number) {
		const { commonStore } = this.props;
		commonStore.menuClose(this.props.id);
	};
	
	onSubmit (e: any) {
		e.preventDefault();
	};
	
	onKeyUp (e: any) {
		const filter = this.filterRef.getValue().toLowerCase();
		this.setState({ filter: filter });
	};
	
};

export default MenuAccount;