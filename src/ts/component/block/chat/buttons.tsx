import * as React from 'react';
import { observer } from 'mobx-react';
import { Icon } from 'Component';
import { I } from 'Lib';

interface Props {
	block: I.Block;
	buttons: any[];
	onButton: (e: React.MouseEvent, type: any) => void;
};

interface State {
	buttons: any[];
};

const ChatButtons = observer(class ChatButtons extends React.Component<Props> {

	render () {
		const { block, buttons, onButton } = this.props;

		return (
			<div className="buttons">
				{buttons.map((item: any, i: number) => {
					const cn = [ item.icon ];
					if (item.isActive) {
						cn.push('isActive');
					};

					return (
						<Icon 
							id={`button-${block.id}-${item.type}`} 
							key={i} 
							className={cn.join(' ')} 
							tooltip={item.name}
							tooltipCaption={item.caption}
							tooltipY={I.MenuDirection.Top}
							inner={item.inner}
							onMouseDown={e => onButton(e, item.type)} 
						/>
					);
				})}
			</div>
		);
	};

	componentDidMount(): void {
		this.setButtons(this.props.buttons);
	};

	setButtons (buttons: any[]) {
		this.setState({ buttons });
	};

});

export default ChatButtons;