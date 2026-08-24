import { SlidersHorizontal } from "lucide-react";
import type { Feature } from "../types";

type EditableNumber = { key: string; label: string; value: number; unit?: string };

function numericFields(feature: Feature): EditableNumber[] {
  switch (feature.type) {
    case "box":
      return [
        { key: "width", label: "Width", value: feature.width, unit: "mm" },
        { key: "depth", label: "Depth", value: feature.depth, unit: "mm" },
        { key: "height", label: "Height", value: feature.height, unit: "mm" },
      ];
    case "cylinder":
      return [
        { key: "radius", label: "Radius", value: feature.radius, unit: "mm" },
        { key: "height", label: "Height", value: feature.height, unit: "mm" },
      ];
    case "hole_pattern":
      return [{ key: "diameter", label: "Diameter", value: feature.diameter, unit: "mm" }];
    case "fillet":
      return [{ key: "radius", label: "Radius", value: feature.radius, unit: "mm" }];
    case "custom_cadquery":
      return feature.parameters.map((parameter, index) => ({
        key: `parameters.${index}`,
        label: parameter.name,
        value: parameter.value,
        unit: parameter.unit,
      }));
    default:
      return [];
  }
}

export function Inspector({
  feature,
  disabled,
  onNumericChange,
}: {
  feature: Feature | null;
  disabled: boolean;
  onNumericChange: (key: string, value: number) => void;
}) {
  return (
    <aside className="inspector-panel">
      <div className="panel-heading inspector-title">
        <span>PROPERTIES</span>
        <SlidersHorizontal size={14} />
      </div>
      {!feature ? (
        <div className="empty-inspector">Select a feature to edit its parameters.</div>
      ) : (
        <div className="inspector-body">
          <div className="feature-kind">{feature.type.replaceAll("_", " ")}</div>
          <h2>{feature.name}</h2>
          <div className="property-section-title">Parameters</div>
          {numericFields(feature).map((field) => (
            <label className="property-row" key={field.key}>
              <span>{field.label}</span>
              <span className="number-input-wrap">
                <input
                  aria-label={field.label}
                  type="number"
                  min="0.001"
                  step="0.5"
                  value={field.value}
                  disabled={disabled}
                  onChange={(event) => onNumericChange(field.key, Number(event.target.value))}
                />
                {field.unit && <em>{field.unit}</em>}
              </span>
            </label>
          ))}
          {feature.type === "hole_pattern" && (
            <div className="property-note">{feature.points.length} hole locations</div>
          )}
          {feature.type === "custom_cadquery" && (
            <details className="source-details">
              <summary>CadQuery source</summary>
              <pre>{feature.source}</pre>
            </details>
          )}
          {numericFields(feature).length === 0 && feature.type !== "custom_cadquery" && (
            <div className="property-note">This imported base has no native parameters.</div>
          )}
        </div>
      )}
    </aside>
  );
}
