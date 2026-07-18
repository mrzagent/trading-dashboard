import { COIN_ICON, COIN_COLOR } from "./constants";
import "./PositionsTable.css";

import noPosition from "../../assets/empty.svg";

export default function PositionsTable({ positions }) {
  if (!positions || positions.length === 0) {
    return (
      <div className="positions-empty">
        <span className="empty-icon">
          <img src={noPosition} alt="No positions" />
        </span>
        <p>No open positions</p>
        <span>Strategies are monitoring for entry signals</span>
      </div>
    );
  }

  return (
    <div className="positions-table-wrapper">
      <table className="positions-table">
        <thead>
          <tr>
            <th>Coin</th>
            <th>Side</th>
            <th>Strategy</th>
            <th>Size</th>
            <th>Leverage</th>
            <th>Signal</th>
            <th>Order</th>
            <th>Entry</th>
            <th>Mark</th>
            <th>SL (%)</th>
            <th>TP (%)</th>
            <th>PnL</th>
            <th>HL Orders</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => (
            <tr key={idx} className="position-row">
              <td>
                <div className="pos-coin">
                  {COIN_ICON[pos.coin] && (
                    <img
                      src={COIN_ICON[pos.coin]}
                      alt={pos.coin}
                      className="pos-coin-icon"
                    />
                  )}
                  <span className="pos-coin-name">{pos.coin}</span>
                </div>
              </td>
              <td>
                <span className="pos-side" data-side={pos.side?.toLowerCase()}>
                  {pos.side}
                </span>
              </td>
              <td className="pos-strategy">
                <p>{pos.strategy ? pos.strategy.replace(/_/g, " ") : "—"}</p>
              </td>
              <td className="pos-size">{pos.size?.toFixed(4) || pos.size}</td>
              <td className="pos-leverage">
                {pos.leverage ? `${pos.leverage}x` : "—"}
              </td>
              <td className="pos-time">{pos.signalTime || "—"}</td>
              <td className="pos-time">{pos.orderPlacedTime || "—"}</td>
              <td className="pos-entry">
                ${pos.entryPrice?.toFixed(2) || pos.entry}
              </td>
              <td className="pos-mark">
                ${pos.markPrice?.toFixed(2) || pos.mark}
              </td>
              <td className="pos-sl">
                <p>
                  ${pos.stopLoss?.toFixed(2) || pos.sl}
                  {pos.stopLossDistance > 0 && (
                    <span className="distance"> ({pos.stopLossDistance}%)</span>
                  )}
                </p>
              </td>
              <td className="pos-tp">
                <p>
                  ${pos.takeProfit?.toFixed(2) || pos.tp}
                  {pos.takeProfitDistance > 0 && (
                    <span className="distance">
                      {" "}
                      ({pos.takeProfitDistance}%)
                    </span>
                  )}
                </p>
              </td>
              <td
                className={`pos-pnl ${(pos.unrealizedPnl || pos.pnl) >= 0 ? "positive" : "negative"}`}
              >
                {(pos.unrealizedPnl || pos.pnl) >= 0 ? "+" : ""}$
                {(pos.unrealizedPnl || pos.pnl)?.toFixed(2) || "0.00"}
              </td>
              <td className="pos-orders">
                {pos.orderId && (
                  <div className="order-ids">
                    {pos.orderId && (
                      <span
                        className="oid entry"
                        title={`Entry: ${pos.orderId}`}
                      >
                        E
                      </span>
                    )}
                    {pos.slOrderId && (
                      <span className="oid sl" title={`SL: ${pos.slOrderId}`}>
                        S
                      </span>
                    )}
                    {pos.tpOrderIds?.length > 0 && (
                      <span
                        className="oid tp"
                        title={`TP: ${pos.tpOrderIds.join(", ")}`}
                      >
                        T
                      </span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
