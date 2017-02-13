/*
 * Copyright 2016 Palantir Technologies, Inc. All rights reserved.
 * Licensed under the BSD-3 License as modified (the “License”); you may obtain a copy
 * of the license at https://github.com/palantir/blueprint/blob/master/LICENSE
 * and https://github.com/palantir/blueprint/blob/master/PATENTS
 */

import * as classNames from "classnames";
import * as PureRender from "pure-render-decorator";
import * as React from "react";

import { Classes, HTMLInputProps, IProps, Position, removeNonHTMLProps, Utils } from "../../common";
import { Button } from "../button/buttons";
import { IInputGroupProps, InputGroup } from "../forms/inputGroup";
import { Menu } from "../menu/menu";
import { MenuDivider } from "../menu/menuDivider";
import { IMenuItemProps, MenuItem } from "../menu/menuItem";
import { IPopoverProps, Popover } from "../popover/popover";
import { getCaretIconClass } from "./popoverUtils";

export type DropdownItemId = string;

export interface IDropdownMenuItemProps extends IMenuItemProps {
    /**
     * Unique identifier.
     */
    id: DropdownItemId;
}

export interface IDropdownProps extends IProps {
    /**
     * Whether to render a search input inside the dropdown which filters items.
     * Customize the behavior of this input using the other `filter*` props.
     * @default true
     */
    filterEnabled?: boolean;

    /**
     * @default false
     */
    filterIsCaseSensitive?: boolean;

    /**
     * Props to pass directly to the HTML `<input>` element backing the filter.
     */
    filterProps?: IInputGroupProps & HTMLInputProps;

    /**
     * All available dropdown choices, optionally organized into groups.
     * If items.default is provided, groups are ignored.
     * @default { default: [] }
     */
    items: {
        default?: IDropdownMenuItemProps[];
        [groupName: string]: IDropdownMenuItemProps[];
    };

    /**
     * A custom renderer to use for each dropdown item.
     * @default <MenuItem />
     */
    itemRenderer?: (props: IDropdownMenuItemProps) => JSX.Element;

    /**
     * @default "No results"
     */
    noResultsText?: string;

    /**
     * Callback fired when an item is selected.
     */
    onChange?: (id: DropdownItemId) => void;

    /**
     * Placeholder text rendered in the popover target when nothing is selected.
     * @default "Select"
     */
    placeholder?: string;

    /**
     * Any custom popover props used to override default values.
     */
    popoverProps?: Partial<IPopoverProps>;

    /**
     * A custom renderer to use for the dropdown target.
     * Children supplied to this renderer will include the target text as well as a caret icon span
     * indicating which direction the dropdown will open in.
     * @default renderer produces an <a> tag
     */
    targetRenderer?: (props: { children: React.ReactNode }) => JSX.Element;
}

export interface IDropdownState {
    searchQuery?: string;
    value: DropdownItemId;
}

@PureRender
export class Dropdown extends React.Component<IDropdownProps, IDropdownState> {

    public static defaultProps: IDropdownProps = {
        filterEnabled: true,
        filterIsCaseSensitive: false,
        filterProps: {},
        itemRenderer: (itemProps) => <MenuItem {...itemProps} />,
        items: {
            default: [],
        },
        noResultsText: "No results",
        placeholder: "Select",
        popoverProps: {},
        targetRenderer: (props: { children: React.ReactNode }) => <Button {...props} />,
    };

    public constructor(props: IDropdownProps, context?: any) {
        super(props, context);
        this.state = {
            searchQuery: "",
            value: undefined,
        };
    }

    public render() {
        const { className, filterEnabled, popoverProps } = this.props;
        const popoverContent = (
            <div>
                {filterEnabled && this.renderFilterInput()}
                {this.renderMenu()}
            </div>
        );

        return (
            <div className={classNames(Classes.DROPDOWN, className)}>
                <Popover
                    position={Position.BOTTOM}
                    {...popoverProps}
                    content={popoverContent}
                    popoverClassName={classNames(Classes.DROPDOWN_POPOVER, popoverProps.popoverClassName)}
                >
                    {this.renderTarget()}
                </Popover>
            </div>
        );
    }

    private renderTarget() {
        const { placeholder, popoverProps, targetRenderer } = this.props;
        const targetText = this.state.value === undefined
            ? placeholder
            : this.findItemById(this.state.value).text;

        return targetRenderer({
            children: [
                targetText,
                <span
                    className={classNames(Classes.ICON_STANDARD, getCaretIconClass(popoverProps), Classes.ALIGN_RIGHT)}
                    key="__caret_icon"
                />,
            ],
        });
    }

    private renderFilterInput() {
        return <InputGroup
            autoFocus
            leftIconName="search"
            placeholder="Filter..."
            {...removeNonHTMLProps(this.props.filterProps, ["ref"])}
            className={classNames(Classes.DROPDOWN_SEARCH, this.props.filterProps.className)}
            onChange={this.handleSearchChange}
            value={this.state.searchQuery}
        />;
    }

    private handleSearchChange = ({ currentTarget }: React.KeyboardEvent<HTMLInputElement>) => {
        this.setState({
            ...this.state,
            searchQuery: currentTarget.value,
        });
    }

    private renderMenu() {
        const { items, noResultsText, filterEnabled, filterIsCaseSensitive } = this.props;
        const { searchQuery } = this.state;
        const searchPredicate = (props: IDropdownMenuItemProps) => {
            if (filterEnabled && searchQuery !== undefined && searchQuery.length > 0) {
                const searchText = filterIsCaseSensitive ? props.text : props.text.toLowerCase();
                const query = filterIsCaseSensitive ? searchQuery : searchQuery.toLowerCase();
                return searchText.indexOf(query) >= 0;
            } else {
                return true;
            }
        };
        let menuContents: JSX.Element[] = [];

        if (items.default !== undefined) {
            menuContents = items.default.filter(searchPredicate).map(this.renderMenuItem, this);
        } else {
            for (const groupName of Object.keys(items)) {
                // only show this group if it fulfills the search predicate
                const filteredItems = items[groupName].filter(searchPredicate);
                if (filteredItems.length > 0) {
                    menuContents.push(<MenuDivider key={`__divider_${groupName}`} title={groupName} />);
                    menuContents.push(...filteredItems.map(this.renderMenuItem, this));
                }
            }
        }

        if (menuContents.length === 0) {
            menuContents.push(<MenuItem
                disabled={true}
                key="__item_no_results"
                text={noResultsText}
            />);
        }

        return <Menu>{menuContents}</Menu>;
    }

    private renderMenuItem(itemProps: IDropdownMenuItemProps) {
        return Utils.safeInvoke(this.props.itemRenderer, {
            ...itemProps,
            isActive: (itemProps.id === this.state.value),
            key: `__item:${itemProps.id}`,
            onClick: (e: React.MouseEvent<HTMLElement>) => {
                Utils.safeInvoke(itemProps.onClick, e);
                this.handleItemClick(itemProps.id);
            },
        });
    }

    private handleItemClick = (id: DropdownItemId) => {
        this.setState({
            ...this.state,
            value: id,
        }, () => {
            Utils.safeInvoke(this.props.onChange, id);
        });
    }

    private findItemById(id: DropdownItemId): IDropdownMenuItemProps {
        const { items } = this.props;
        if (items.default !== undefined) {
            return items.default.filter((props) => props.id === id)[0];
        } else {
            for (const groupName of Object.keys(items)) {
                const [maybeItem] = items[groupName].filter((props) => props.id === id);
                if (maybeItem !== undefined) {
                    return maybeItem;
                }
            }
            return undefined;
        }
    }
}
