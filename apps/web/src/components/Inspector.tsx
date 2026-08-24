import { PanelRightClose, SlidersHorizontal } from "lucide-react";
import { CSSProperties, KeyboardEvent, useEffect, useRef, useState } from "react";
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

function baseValue(value: number, unit: string | undefined, displayUnit: DisplayUnit) {
  return unit === "mm" ? value * millimetresPerUnit[displayUnit] : value;
}

function sliderBounds(field: EditableNumber, displayUnit: DisplayUnit) {
  const value = displayValue(field.value, field.unit, displayUnit);
  const isLength = field.unit === "mm";
  const reference = isLength ? 100 / millimetresPerUnit[displayUnit] : 100;
  const step = isLength
    ? displayUnit === "inch" ? 0.01 : displayUnit === "cm" ? 0.05 : 0.5
    : Math.max(Math.abs(value) / 100, 0.1);
  if (field.positive === false) {
    const extent = Math.max(Math.abs(value) * 2.5, reference);
    return { min: -extent, max: extent, step };
  }
  return {
    min: isLength ? 0.1 / millimetresPerUnit[displayUnit] : 0.001,
    max: Math.max(Math.abs(value) * 3, reference),
    step,
  };
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
  onToggle,
}: {
  feature: Feature | null;
  displayUnit: DisplayUnit;
  disabled: boolean;
  onDisplayUnitChange: (unit: DisplayUnit) => void;
  onNumericChange: (key: string, value: number) => void;
  onToggle: () => void;
}) {
  return (
    <aside className="inspector-panel">
      <div className="panel-heading inspector-title">
        <span>PROPERTIES</span>
        <div className="inspector-heading-actions">
          <div className="unit-switch" role="group" aria-label="Display units">
            {(["mm", "cm", "inch"] as DisplayUnit[]).map((unit) => (
              <button
                className={displayUnit === unit ? "selected" : ""}
                type="button"
                aria-label={unit}
                aria-pressed={displayUnit === unit}
                key={unit}
                onClick={() => onDisplayUnitChange(unit)}
              >
                {unit === "inch" ? "in" : unit}
              </button>
            ))}
          </div>
          <SlidersHorizontal size={14} />
          <button className="panel-action" type="button" aria-label="Close Properties" title="Close Properties" onClick={onToggle}>
            <PanelRightClose size={14} />
          </button>
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
          <div className="parameter-controls">
            {numericFields(feature).map((field) => (
              <ParameterControl
                key={`${feature.id}-${field.key}`}
                field={field}
                displayUnit={displayUnit}
                disabled={disabled}
                onCommit={onNumericChange}
              />
            ))}
          </div>
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

function ParameterControl({ field, displayUnit, disabled, onCommit }: {
  field: EditableNumber;
  displayUnit: DisplayUnit;
  disabled: boolean;
  onCommit: (key: string, value: number) => void;
}) {
  const externalValue = displayValue(field.value, field.unit, displayUnit);
  const [draft, setDraft] = useState(externalValue);
  const draftRef = useRef(externalValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounds = sliderBounds(field, displayUnit);
  const progress = Math.max(0, Math.min(100, ((draft - bounds.min) / (bounds.max - bounds.min)) * 100));

  useEffect(() => {
    setDraft(externalValue);
    draftRef.current = externalValue;
  }, [externalValue]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function commit(value = draftRef.current) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!Number.isFinite(value)) return;
    onCommit(field.key, baseValue(value, field.unit, displayUnit));
  }

  function update(value: number) {
    if (!Number.isFinite(value)) return;
    setDraft(value);
    draftRef.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), 280);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <div className="parameter-control">
      <div className="parameter-control-heading">
        <label htmlFor={`parameter-${field.key}`}>{field.label}</label>
        <span className="number-input-wrap">
          <input
            id={`parameter-${field.key}`}
            aria-label={field.label}
            type="number"
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            value={draft}
            disabled={disabled}
            onChange={(event) => update(Number(event.target.value))}
            onBlur={() => commit()}
            onKeyDown={handleKeyDown}
          />
          {field.unit && <em>{field.unit === "mm" ? displayUnit : field.unit}</em>}
        </span>
      </div>
      <input
        className="parameter-slider"
        aria-label={`${field.label} slider`}
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={draft}
        disabled={disabled}
        style={{ "--range-progress": `${progress}%` } as CSSProperties}
        onChange={(event) => update(Number(event.target.value))}
        onPointerUp={() => commit()}
        onKeyUp={() => commit()}
      />
      <div className="parameter-range"><span>{Number(bounds.min.toFixed(3))}</span><span>{Number(bounds.max.toFixed(3))}</span></div>
    </div>
  );
}
