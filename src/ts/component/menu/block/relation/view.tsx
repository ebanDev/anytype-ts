import * as React from 'react';
import { I, C, DataUtil, Util } from 'ts/lib';
import { Icon, Cell } from 'ts/component';
import { commonStore, blockStore, dbStore } from 'ts/store';
import { observer } from 'mobx-react';
import { AutoSizer, CellMeasurer, InfiniteLoader, List, CellMeasurerCache } from 'react-virtualized';
import 'react-virtualized/styles.css';

interface Props extends I.Menu {};

const $ = require('jquery');
const PREFIX = 'menuBlockRelationViewCell';

@observer
class MenuBlockRelationView extends React.Component<Props, {}> {

	cellRefs: Map<string, any> = new Map();

	constructor (props: any) {
		super(props);

		this.onCellClick = this.onCellClick.bind(this);
		this.onCellChange = this.onCellChange.bind(this);
		this.optionCommand = this.optionCommand.bind(this);
	};

	render () {
		const { param } = this.props;
		const { data } = param;
		const { rootId } = data;
		const block = blockStore.getLeaf(rootId, rootId);
		const details = blockStore.getDetails(rootId, rootId);
		const sections = this.getSections();

		const Section = (section: any) => (
			<div className="section">
				<div className="name">{section.name}</div>
				<div className="items">
					{section.children.map((item: any, i: number) => {
						return <Item key={i} {...item} />;
					})}
					{section.index == sections.length - 1 ? <ItemAdd /> : ''}
				</div>
			</div>
		);

		const ItemAdd = (item: any) => (
			<div id="item-add" className="item sides add" onClick={(e: any) => { this.onAdd(e); }}>
				<div className="info">
					<Icon className="plus" />
					<div className="name">New</div>
				</div>
				<div className="cell" />
			</div>
		);

		const Item = (item: any) => {
			const id = DataUtil.cellId(PREFIX, item.relationKey, '0');
			return (
				<div className="item sides">
					<div className="info">
						<Icon className={'relation ' + DataUtil.relationClass(item.format)} />
						{item.name}
					</div>
					<div
						id={id} 
						className={[ 'cell', DataUtil.relationClass(item.format), 'canEdit' ].join(' ')} 
						onClick={(e: any) => { this.onCellClick(e, item.relationKey, 0); }}
					>
						<Cell 
							ref={(ref: any) => { this.cellRefs.set(id, ref); }} 
							rootId={rootId}
							storeId={rootId}
							block={block}
							relationKey={item.relationKey}
							getRecord={() => { return details; }}
							viewType={I.ViewType.Grid}
							index={0}
							idPrefix={PREFIX}
							menuClassName="fromBlock"
							scrollContainer={Util.getEditorScrollContainer('menu')}
							pageContainer={Util.getEditorPageContainer('menu')}
							readOnly={false}
							onCellChange={this.onCellChange}
							optionCommand={this.optionCommand}
						/>
					</div>
				</div>
			);
		};

		return (
			<div className="sections">
				{sections.map((item: any, i: number) => {
					return <Section key={i} {...item} index={i} />;
				})}
			</div>
		);
	};

	componentDidMount () {
		this.resize();

		$('body').addClass('over');
	};

	componentDidUpdate () {
		this.resize();
	};

	componentWillUnmount () {
		$('body').removeClass('over');
	};

	getSections () {
		const { param } = this.props;
		const { data } = param;
		const { rootId } = data;
		
		let items = dbStore.getRelations(rootId, rootId)//.filter((it: any) => { return !it.isHidden; });
		let featured = [ 'type', 'description', 'creator' ];

		return [ 
			{ 
				id: 'featured', name: 'Featured relations', 
				children: items.filter((it: any) => { 
					console.log(it);
					return featured.indexOf(it.relationKey) >= 0; 
				}),
			},
			{ 
				id: 'all', name: 'All relations', 
				children: items.filter((it: any) => { return featured.indexOf(it.relationKey) < 0; }),
			},
		];
	};

	getItems () {
		const sections = this.getSections();
		
		let items: any[] = [];
		for (let section of sections) {
			items = items.concat(section.children);
		};
		
		return items;
	};

	onAdd (e: any) {
		const { param, close, getId } = this.props;
		const { data } = param;

		commonStore.menuOpen('blockRelationEdit', { 
			type: I.MenuType.Vertical,
			element: `#${getId()} #item-add`,
			offsetX: 0,
			offsetY: 0,
			vertical: I.MenuDirection.Bottom,
			horizontal: I.MenuDirection.Left,
			data: {
				...data,
				onChange: (message: any) => { 
					if (message.error.code) {
						return;
					};

					close();
				},
			}
		});
	};

	onCellClick (e: any, relationKey: string, index: number) {
		const { param } = this.props;
		const { data } = param;
		const { rootId, readOnly } = data;
		const relation = dbStore.getRelation(rootId, rootId, relationKey);

		if (!relation || readOnly || relation.isReadOnly) {
			return;
		};

		const id = DataUtil.cellId(PREFIX, relationKey, index);
		const ref = this.cellRefs.get(id);

		if (ref) {
			ref.onClick(e);
		};
	};

	onCellChange (id: string, key: string, value: any) {
		const { param } = this.props;
		const { data } = param;
		const { rootId } = data;

		C.BlockSetDetails(rootId, [ 
			{ key: key, value: value },
		]);
	};

	optionCommand (code: string, rootId: string, blockId: string, relationKey: string, recordId: string, option: I.SelectOption, callBack?: (message: any) => void) {
		switch (code) {
			case 'add':
				C.ObjectRelationOptionAdd(rootId, relationKey, option, callBack);
				break;

			case 'update':
				C.ObjectRelationOptionUpdate(rootId, relationKey, option, callBack);
				break;

			case 'delete':
				C.ObjectRelationOptionDelete(rootId, relationKey, option.id, callBack);
				break;
		};
	};

	resize () {
		const { getId, position } = this.props;
		const obj = $('#' + getId() + ' .content');
		const sections = obj.find('.sections');
		const win = $(window);
		const height = Math.max(92, Math.min(win.height() - 56, sections.height() + 64));

		obj.css({ height: height });
		position();
	};

};

export default MenuBlockRelationView;