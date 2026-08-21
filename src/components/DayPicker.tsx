import { useMemo, useState } from "react";
import { CalendarIcon, SearchIcon } from "./Icons";
import { daySearchText, formatCount, formatDayLabel } from "../lib/format";

interface DayPickerProps {
  dates: string[];
  selectedDate: string;
  messageCounts: Map<string, number>;
  onSelectDate: (date: string) => void;
  variant?: "list" | "select";
}

export function DayPicker({
  dates,
  selectedDate,
  messageCounts,
  onSelectDate,
  variant = "list",
}: DayPickerProps) {
  const [query, setQuery] = useState("");
  const visibleDates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const newestFirst = [...dates].reverse();
    return normalizedQuery
      ? newestFirst.filter((date) => daySearchText(date).includes(normalizedQuery))
      : newestFirst;
  }, [dates, query]);

  return (
    <div className="day-picker">
      <label className="search-control">
        <span className="sr-only">Search dates</span>
        <SearchIcon className="control-icon" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dates…"
          autoComplete="off"
        />
      </label>

      {variant === "select" ? (
        <label className="mobile-day-select">
          <CalendarIcon className="control-icon" />
          <select
            aria-label="Choose a day"
            value={selectedDate}
            onChange={(event) => onSelectDate(event.target.value)}
          >
            {visibleDates.map((date) => (
              <option key={date} value={date}>
                {formatDayLabel(date)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="day-list" role="listbox" aria-label="Village days">
          {visibleDates.map((date) => (
            <button
              key={date}
              type="button"
              role="option"
              aria-selected={date === selectedDate}
              className="filter-row day-row"
              onClick={() => onSelectDate(date)}
            >
              <CalendarIcon className="row-icon" />
              <span className="filter-row__label">{formatDayLabel(date)}</span>
              {messageCounts.has(date) && (
                <span className="filter-row__count">
                  {formatCount(messageCounts.get(date) ?? 0)}
                </span>
              )}
            </button>
          ))}
          {visibleDates.length === 0 && (
            <p className="empty-filter-list">No matching days.</p>
          )}
        </div>
      )}
    </div>
  );
}
