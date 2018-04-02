import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import ViewButtons from './blockchain/ViewButtons';

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to Win The Pot</h1>
        </header>
        <p className="App-intro">
          Contribute Ethereum to the pot to get a chance to win it.
        </p>
      <ViewButtons></ViewButtons>
      </div>
    );
  }
}

export default App;
