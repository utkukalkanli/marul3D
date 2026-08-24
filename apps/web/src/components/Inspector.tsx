import { SlidersHorizontal } from "lucide-react";
import type { DisplayUnit, Feature } from "../types";

type EditableNumber = { key: string; label: string; value: number; unit?: string; positive?: boolean };

const millimetresPerUnit: Record<DisplayUnit, number> = {
  mm: 1,
  cm: 10,
  inch: 25.4,
};

function displayValue(value: number, unit: string | undefined, displayUnit: DisplayUnit) {
  if (unit !== "mm") return value;
  const precision = displayUnit === "inch" ? 4 : displayUnit === "cm" ? 3 : 3;
  return Number((value / millimetresPerUnit[displayUnit]).toFixed(precision));
}

function numericFields(feature: Feature): EditableNumber[] {
  switch (feature.type) {
    case "sketch":
      return [...(feature.profile === "circle"
        ? [{ key: "radius", label: "Radius", value: feature.radius, unit: "mm" }]
        : [
            { key: "width", label: "Width", value: feature.width, unit: "mm" },
            { key: "height", label: "Height", value: feature.height, unit: "mm" },
          ]),
        { key: "origin_x", label: "Origin X", value: feature.origin_x, unit: "mm", positive: false },
        { key: "origin_y", label: "Origin Y", value: feature.origin_y, unit: "mm", positive: false },
        { key: "origin_z", label: "Origin Z", value: feature.origin_z, unit: "mm", positive: false },
      ];
    case "extrude":
      return [{ key: "distance", label: "Distance", value: feature.distance, unit: "mm" }];
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
      return [
        { key: "diameter", label: "Diameter", value: feature.diameter, unit: "mm" },
        { key: "points.0.x", label: "Position X", value: feature.points[0].x, unit: "mm", positive: false },
        { key: "points.0.y", label: "Position Y", value: feature.points[0].y, unit: "mm", positive: false },
      ];
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
  displayUnit,
  disabled,
  onDisplayUnitChange,
  onNumericChange,
}: {
  feature: Feature | null;
  displayUnit: DisplayUnit;
  disabled: boolean;
  onDisplayUnitChange: (unit: DisplayUnit) => void;
  onNumericChange: (key: string, value: number) => void;
}) {
  return (
    <aside className="inspector-panel">
      <div className="panel-heading inspector-title">
        <span>PROPERTIES</span>
        <div className="inspector-heading-actions">
          <select
            className="unit-select"
            aria-label="Display units"
            value={displayUnit}
            onChange={(event) => onDisplayUnitChange(event.target.value as DisplayUnit)}
          >
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="inch">inch</option>
          </select>
          <SlidersHorizontal size={14} />
        </div>
      </div>
      {!feature ? (
        <div className="empty-inspector">Select a feature to edit its parameters.</div>
      ) : (
        <div className="inspector-body">
          <div className="feature-kind">
            {feature.type === "custom_cadquery" ? "custom geometry" : feature.type.replaceAll("_", " ")}
          </div>
          <h2>{feature.name}</h2>
          <div className="property-section-title">Parameters</div>
          {numericFields(feature).map((field) => {
            const isLength = field.unit === "mm";
            return (
              <label className="property-row" key={field.key}>
                <span>{field.label}</span>
                <span className="number-input-wrap">
                  <input
                    aria-label={field.label}
                    type="number"
                    min={field.positive === false ? undefined : "0.001"}
                    step={displayUnit === "inch" && isLength ? "0.01" : "0.1"}
                    value={displayValue(field.value, field.unit, displayUnit)}
                    disabled={disabled}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      onNumericChange(
                        field.key,
                        isLength ? value * millimetresPerUnit[displayUnit] : value,
                      );
                    }}
                  />
                  {field.unit && <em>{isLength ? displayUnit : field.unit}</em>}
                </span>
              </label>
            );
          })}
          {feature.type === "hole_pattern" && (
            <div className="property-note">{feature.points.length} hole locations</div>
          )}
          {numericFields(feature).length === 0 && feature.type !== "custom_cadquery" && (
            <div className="property-note">This imported base has no native parameters.</div>
          )}
        </div>
      )}
    </aside>
  );
}
