import * as React from 'react';
import $ from 'jquery';
import { observer } from 'mobx-react';
import { Header, Footer, Loader } from 'Component';
import { blockStore, detailStore, commonStore } from 'Store';
import { I, UtilCommon, UtilData, UtilObject, keyboard, Action, focus, UtilDate } from 'Lib';
import HistoryLeft from './history/left';
import HistoryRight from './history/right';

const Diff = require('diff');
const Constant = require('json/constant.json');

interface State {
	isLoading: boolean;
};

const PageMainHistory = observer(class PageMainHistory extends React.Component<I.PageComponent, State> {

	node = null;
	refHeader = null;
	refSideLeft = null;
	refSideRight = null;
	state = {
		isLoading: false,
	};

	constructor (props: I.PageComponent) {
		super(props);

		this.getWrapperWidth = this.getWrapperWidth.bind(this);
		this.renderDiff = this.renderDiff.bind(this);
		this.setVersion = this.setVersion.bind(this);
		this.setLoading = this.setLoading.bind(this);
		this.onCopy = this.onCopy.bind(this);
		this.onClose = this.onClose.bind(this);
	};

	render () {
		const { isLoading } = this.state;
		const rootId = this.getRootId();

		return (
			<div ref={node => this.node = node}>
				<Header 
					{...this.props} 
					ref={ref => this.refHeader = ref}
					component="mainHistory" 
					rootId={rootId}
					layout={I.ObjectLayout.History}
				/>

				{isLoading ?  <Loader id="loader" /> : ''}

				<div id="body" className="flex">
					<HistoryLeft 
						ref={ref => this.refSideLeft = ref} 
						{...this.props} 
						rootId={rootId} 
						onCopy={this.onCopy} 
						getWrapperWidth={this.getWrapperWidth}
					/>

					<HistoryRight 
						ref={ref => this.refSideRight = ref} 
						{...this.props} 
						rootId={rootId}
						renderDiff={this.renderDiff}
						setVersion={this.setVersion}
						setLoading={this.setLoading}
					/>
				</div>

				<Footer component="mainObject" {...this.props} />
			</div>
		);
	};
	
	componentDidMount () {
		this.resize();
		this.rebind();
	};

	componentDidUpdate () {
		this.resize();
		this.rebind();
	};

	componentWillUnmount(): void {
		this.unbind();

		blockStore.clear(this.getRootId());
		commonStore.diffSet([]);
	};

	unbind () {
		const { isPopup } = this.props;
		const namespace = UtilCommon.getEventNamespace(isPopup);
		const events = [ 'keydown' ];

		$(window).off(events.map(it => `${it}.history${namespace}`).join(' '));
	};

	rebind () {
		const { isPopup } = this.props;
		const win = $(window);
		const namespace = UtilCommon.getEventNamespace(isPopup);

		this.unbind();
		win.on('keydown.history' + namespace, e => this.onKeyDown(e));
	};

	onKeyDown (e: any) {
		const cmd = keyboard.cmdKey();

		keyboard.shortcut(`${cmd}+c, ${cmd}+x`, e, () => this.onCopy());
	};

	onClose () {
		const rootId = this.getRootId();

		UtilObject.openAuto(detailStore.get(rootId, rootId, []));
	};

	onCopy () {
		const { dataset } = this.props;
		const { selection } = dataset || {};
		const rootId = this.getRootId();
		const { focused } = focus.state;

		let ids = selection.get(I.SelectType.Block, true);
		if (!ids.length) {
			ids = [ focused ];
		};
		ids = ids.concat(blockStore.getLayoutIds(rootId, ids));

		Action.copyBlocks(rootId, ids, false);
	};

	renderDiff (previousId: string, diff: any[]) {
		const node = $(this.node);

		// Remove all diff classes
		for (const i in I.DiffType) {
			if (isNaN(Number(i))) {
				continue;
			};

			const c = `diff${I.DiffType[i]}`;
			node.find(`.${c}`).removeClass(c);
		};

		let elements = [];

		diff.forEach(it => {
			elements = elements.concat(this.getElements(previousId, it));
		});

		elements = elements.map(it => ({ ...it, element: $(it.element) })).filter(it => it.element.length);

		if (elements.length) {
			elements.forEach(it => {
				it.element.addClass(UtilData.diffClass(it.type));
			});

			this.scrollToElement(elements[0].element);
		};
	};

	scrollToElement (element: any) {
		const node = $(this.node);
		const container = node.find('#historySideLeft');
		const ch = container.height();
		const no = element.offset().top;
		const st = container.scrollTop();
		const y = no - container.offset().top + st + ch / 2;

		container.scrollTop(Math.max(y, ch) - ch);
	};

	getElements (previousId: string, event: any) {
		const { type, data } = event;
		const rootId = this.getRootId();
		const oldContextId = [ rootId, previousId ].join('-');

		let elements = [];
		switch (type) {
			case 'BlockAdd': {
				data.blocks.forEach(it => {
					elements = elements.concat([
						{ type: I.DiffType.None, element: `#block-${it.id}` },
						{ type: I.DiffType.Add, element: `#block-${it.id} > .wrapContent` },
					]);
				});
				break;
			};

			case 'BlockSetChildrenIds': {
				const newChildrenIds = data.childrenIds;
				const nl = newChildrenIds.length;
				const oldChildrenIds = blockStore.getChildrenIds(oldContextId, data.id);
				const ol = oldChildrenIds.length;

				if (nl >= ol) {
					break;
				};

				const removed = oldChildrenIds.filter(item => !newChildrenIds.includes(item));
				if (removed.length) {
					removed.forEach(it => {
						const idx = oldChildrenIds.indexOf(it);
						const afterId = newChildrenIds[idx - 1];

						if (afterId) {
							elements.push({ type: I.DiffType.Remove, element: `#block-${afterId} > .wrapContent` });
						};
					});
				};
				break;
			};

			case 'BlockSetText': {
				const block = blockStore.getLeaf(rootId, data.id);
				const oldBlock = blockStore.getLeaf(oldContextId, data.id);

				if (!block || !oldBlock) {
					break;
				};

				let type = I.DiffType.None;

				if (data.text !== null) {
					const diff = Diff.diffChars(oldBlock.getText(), String(data.text || '')).filter(it => it.added);

					if (diff.length) {
						const marks = UtilCommon.objectCopy(block.content.marks || []);

						let from = 0;
						for (const item of diff) {
							const to = from + item.count;

							if (item.added) {
								marks.push({ type: I.MarkType.Change, param: '', range: { from, to } });
							};

							from = to;
						};

						blockStore.updateContent(rootId, data.id, { marks });
					} else {
						type = I.DiffType.Change;
					};
				} else {
					type = I.DiffType.Change;
				};

				if (type == I.DiffType.Change) {
					elements = elements.concat(this.getBlockChangeElements(data.id));
				} else {
					elements.push({ type, element: `#block-${data.id}` });
				};
				break;
			};

			case 'BlockSetTableRow':
			case 'BlockSetRelation':
			case 'BlockSetVerticalAlign':
			case 'BlockSetAlign':
			case 'BlockSetBackgroundColor':
			case 'BlockSetLatex':
			case 'BlockSetFile':
			case 'BlockSetBookmark':
			case 'BlockSetDiv':
			case 'BlockSetLink':
			case 'BlockSetFields': {
				elements = elements.concat(this.getBlockChangeElements(data.id));
				break;
			};

			case 'BlockDataviewIsCollectionSet':
			case 'BlockDataviewTargetObjectIdSet':
			case 'BlockDataviewGroupOrderUpdate':
			case 'BlockDataviewObjectOrderUpdate': {
				break;
			};

			case 'BlockDataviewViewOrder': {
				elements = elements.concat([
					{ type: I.DiffType.None, element: `#block-${data.id}` },
					{ type: I.DiffType.Change, element: `#block-${data.id} #view-selector` },
					{ type: I.DiffType.Change, element: `#block-${data.id} #views` },
				]);
				break;
			};

			case 'BlockDataviewViewUpdate': {
				elements.push({ type: I.DiffType.None, element: `#block-${data.id}` });

				if (data.fields !== null) {
					elements = elements.concat([
						{ type: I.DiffType.Change, element: `#block-${data.id} #view-selector` },
						{ type: I.DiffType.Change, element: `#view-item-${data.id}-${data.viewId}` },
					]);
				};

				if (data.relations.length) {
					elements.push({ type: I.DiffType.Change, element: `#block-${data.id} #button-dataview-settings` });
				};

				if (data.filters.length) {
					elements.push({ type: I.DiffType.Change, element: `#block-${data.id} #button-dataview-filter` });
				};

				if (data.sorts.length) {
					elements.push({ type: I.DiffType.Change, element: `#block-${data.id} #button-dataview-sort` });
				};
				break;
			};

			case 'BlockDataviewRelationDelete':
			case 'BlockDataviewRelationSet': {
				elements = elements.concat([
					{ type: I.DiffType.None, element: `#block-${data.id}` },
					{ type: I.DiffType.Change, element: `#block-${data.id} #button-dataview-settings` },
				]);
				break;
			};

			case 'ObjectDetailsSet': 
			case 'ObjectDetailsAmend': {
				const rootId = this.getRootId();

				if (data.id != rootId) {
					break;
				};

				elements.push({ type: I.DiffType.Change, element: '#button-header-relation' });

				if (undefined !== data.details.name) {
					elements = elements.concat([
						{ type: I.DiffType.Change, element: `#block-${Constant.blockId.title}` },
						{ type: I.DiffType.Change, element: `.headSimple #editor-${Constant.blockId.title}` }
					]);
				};

				if (undefined !== data.details.description) {
					elements.push({ type: I.DiffType.Change, element: `#block-${Constant.blockId.description}` });
				};

				if ((undefined !== data.details.iconEmoji) || (undefined !== data.details.iconImage)) {
					elements.push({ type: I.DiffType.Change, element: `#block-icon-${data.id}` });
				};

				if (undefined !== data.details.featuredRelations) {
					elements.push({ type: I.DiffType.Change, element: `#block-${Constant.blockId.featured}` });
				};

				if (type == 'ObjectDetailsAmend') {
					for (const k in data.details) {
						const blocks = blockStore.getBlocks(rootId, it => it.isRelation() && (it.content.key == k));

						blocks.forEach(it => {
							elements = elements.concat(this.getBlockChangeElements(it.id))
						});
					};
				};

				break;
			};
		};

		return elements;
	};

	getBlockChangeElements (id: string) {
		return [
			{ type: I.DiffType.None, element: `#block-${id}` },
			{ type: I.DiffType.Change, element: `#block-${id} > .wrapContent` },
		];
	};

	resize () {
		const { isPopup } = this.props;
		const node = $(this.node);
		const sideLeft = node.find('#historySideLeft');
		const sideRight = node.find('#historySideRight');
		const editorWrapper = node.find('#editorWrapper');
		const cover = node.find('.block.blockCover');
		const container = UtilCommon.getPageContainer(isPopup);
		const sc = UtilCommon.getScrollContainer(isPopup);
		const header = container.find('#header');
		const height = sc.height();
		const hh = isPopup ? header.height() : UtilCommon.sizeHeader();
		const cssl: any = { height };

		sideRight.css({ height });

		if (cover.length) {
			cover.css({ top: hh });
		};

		if (isPopup) {
			$('.pageMainHistory.isPopup').css({ height });
			cssl.paddingTop = hh;
		};

		sideLeft.css(cssl);
		editorWrapper.css({ width: !this.isSetOrCollection() ? this.getWrapperWidth() : '' });
	};

	getWrapperWidth (): number {
		const rootId = this.getRootId();
		const root = blockStore.getLeaf(rootId, rootId);

		return this.getWidth(root?.fields?.width);
	};

	getWidth (w: number) {
		w = Number(w) || 0;

		const node = $(this.node);
		const sideLeft = node.find('#historySideLeft');
		const min = 300;

		let mw = sideLeft.width();
		let width = 0;

		if (this.isSetOrCollection()) {
			width = mw - 192;
		} else {
			const size = mw * 0.6;

			mw -= 96;
			w = (mw - size) * w;
			width = Math.max(size, Math.min(mw, size + w));
		};

		return Math.max(min, width);
	};

	getGroupId (time: number) {
		return UtilDate.date('M d, Y', time);
	};

	getRootId () {
		const { rootId, match } = this.props;
		return rootId ? rootId : match.params.id;
	};

	isSetOrCollection (): boolean {
		const rootId = this.getRootId();
		const root = blockStore.getLeaf(rootId, rootId);

		return root?.isObjectSet() || root?.isObjectCollection();
	};

	setVersion (version: I.HistoryVersion) {
		this.refHeader?.refChild.setVersion(version);
		this.refSideLeft?.forceUpdate();
		this.refSideLeft?.refHead?.forceUpdate();

		$(window).trigger('updateDataviewData');
	};

	setLoading (v: boolean) {
		this.setState({ isLoading: v });
	};

});

export default PageMainHistory;