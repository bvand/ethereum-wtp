import React, { Component } from 'react';
import * as views from "./views";

export default class ViewButtons extends Component {
    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    async handleClick() {
       await views.viewBalance();
    }

    render() {
        return (
            <button onClick={this.handleClick}>
            </button>
        );
    }
}