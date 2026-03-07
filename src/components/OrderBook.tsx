import React from 'react';
import './OrderBook.css';

interface Level {
  price: number;
  size: number;
  cumulative: number;
}

interface Props {
  bids: Level[];
  asks: Level[];
}

const OrderBook: React.FC<Props> = ({ bids, asks }) => {
  return (
    <div className="orderbook-container">
      <div className="orderbook-asks">
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Size</th>
              <th>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {asks.map((a, idx) => (
              <tr key={idx} className="ask-row">
                <td>{a.price.toFixed(2)}</td>
                <td>{a.size}</td>
                <td>{a.cumulative}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="orderbook-bids">
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Size</th>
              <th>Cum.</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((b, idx) => (
              <tr key={idx} className="bid-row">
                <td>{b.price.toFixed(2)}</td>
                <td>{b.size}</td>
                <td>{b.cumulative}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderBook;
