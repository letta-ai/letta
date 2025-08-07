'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { cn } from '@letta-cloud/ui-styles';
import { Popover } from '../Popover/Popover';
import { CalendarIcon } from '../../icons';

// Simple Calendar Component
interface CalendarProps {
  mode?: 'range' | 'single';
  selected?: Date | { from: Date; to?: Date };
  onSelect?: (date: Date | { from: Date; to?: Date } | undefined) => void;
  numberOfMonths?: number;
  className?: string;
}

function Calendar({
  mode = 'single',
  selected,
  onSelect,
  numberOfMonths = 1,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (selected) {
      if (mode === 'single' && selected instanceof Date) {
        return selected;
      }
      if (
        mode === 'range' &&
        typeof selected === 'object' &&
        'from' in selected &&
        selected.from
      ) {
        return selected.from;
      }
    }
    return new Date();
  });

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  }

  function isSelected(date: Date) {
    if (mode === 'single' && selected instanceof Date) {
      return format(selected, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    }
    if (
      mode === 'range' &&
      typeof selected === 'object' &&
      'from' in selected &&
      selected?.from
    ) {
      const fromMatch =
        format(selected.from, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      const toMatch =
        selected.to &&
        format(selected.to, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      return fromMatch || toMatch;
    }
    return false;
  }

  function isInRange(date: Date) {
    if (
      mode === 'range' &&
      typeof selected === 'object' &&
      selected &&
      'from' in selected &&
      selected.from &&
      selected.to
    ) {
      return date >= selected.from && date <= selected.to;
    }
    return false;
  }

  function handleDateClick(date: Date) {
    if (mode === 'single') {
      onSelect?.(date);
    } else if (mode === 'range') {
      const rangeSelected = selected as { from: Date; to?: Date } | undefined;
      if (!rangeSelected?.from || (rangeSelected.from && rangeSelected.to)) {
        onSelect?.({ from: date, to: undefined });
      } else if (rangeSelected.from && !rangeSelected.to) {
        if (date < rangeSelected.from) {
          onSelect?.({ from: date, to: rangeSelected.from });
        } else {
          onSelect?.({ from: rangeSelected.from, to: date });
        }
      }
    }
  }

  function renderMonth(monthOffset = 0) {
    const displayMonth = new Date(currentMonth);
    displayMonth.setMonth(displayMonth.getMonth() + monthOffset);
    const days = getDaysInMonth(displayMonth);

    return (
      <div key={monthOffset} className="p-3">
        <div className="flex items-center justify-between mb-4">
          {monthOffset === 0 && (
            <button
              type="button"
              onClick={() => {
                const newMonth = new Date(currentMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCurrentMonth(newMonth);
              }}
              className="text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border bg-transparent hover:bg-secondary-hover text-text-default border-input transition-colors"
            >
              ‹
            </button>
          )}
          <h3 className="text-xs font-medium text-center flex-1 text-text-default">
            {format(displayMonth, 'MMMM yyyy')}
          </h3>
          {monthOffset === numberOfMonths - 1 && (
            <button
              type="button"
              onClick={() => {
                const newMonth = new Date(currentMonth);
                newMonth.setMonth(newMonth.getMonth() + 1);
                setCurrentMonth(newMonth);
              }}
              className="text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border bg-transparent hover:bg-secondary-hover text-text-default border-input transition-colors"
            >
              ›
            </button>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div
              key={day}
              className="h-8 w-8 text-xs font-medium text-text-lighter flex items-center justify-center"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
            const isToday =
              format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const selected = isSelected(date);
            const inRange = isInRange(date);

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  handleDateClick(date);
                }}
                className={cn(
                  'h-8 w-8 text-xs border transition-colors',
                  'hover:bg-secondary-hover',
                  {
                    'text-text-lighter border-transparent': !isCurrentMonth,
                    'text-text-default border-input': isCurrentMonth,
                    'bg-primary text-primary-content border-transparent':
                      selected,
                    'bg-secondary-active border-input': inRange && !selected,
                    'border-primary border-2': isToday && !selected,
                  },
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border border-input bg-popover text-popover-foreground shadow-lg w-auto',
        className,
      )}
    >
      <div
        className={cn('flex', numberOfMonths > 1 && 'divide-x divide-input')}
      >
        {Array.from({ length: numberOfMonths }, (_, i) => renderMonth(i))}
      </div>
    </div>
  );
}

// Simple ScrollArea component
interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

function ScrollArea({ children, className }: ScrollAreaProps) {
  return (
    <div
      className={cn(
        'overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-input',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Date Picker Component
export interface DatePickerProps {
  value?: Date;
  onValueChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date',
  className,
  disabled,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      autoWidth
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center overflow-hidden border text-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
            'h-inputHeight text-default border-input bg-panel-input-background px-2 gap-2 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {value ? format(value, 'PPP') : placeholder}
        </button>
      }
    >
      <Calendar
        mode="single"
        selected={value}
        onSelect={(date) => {
          onValueChange?.(date as Date | undefined);
          setIsOpen(false);
        }}
      />
    </Popover>
  );
}

// Date Range Picker Component
export interface DateRangePickerProps {
  value?: { from: Date; to?: Date };
  onValueChange?: (range: { from: Date; to?: Date } | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date range',
  className,
  disabled,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const displayText = React.useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, 'LLL dd, y');
    return `${format(value.from, 'LLL dd, y')} - ${format(value.to, 'LLL dd, y')}`;
  }, [value, placeholder]);

  return (
    <Popover
      autoWidth
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center overflow-hidden border text-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
            'h-inputHeight text-default border-input bg-panel-input-background px-2 gap-2 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {displayText}
        </button>
      }
    >
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={value}
        onSelect={(range) => {
          onValueChange?.(range as { from: Date; to?: Date } | undefined);
        }}
      />
    </Popover>
  );
}

// DateTime Picker (12-hour format) Component
export interface DateTimePickerProps {
  value?: Date;
  onValueChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date and time',
  className,
  disabled,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);

  function handleDateSelect(selectedDate: Date | undefined) {
    if (selectedDate && value) {
      const newDate = new Date(selectedDate);
      newDate.setHours(value.getHours(), value.getMinutes());
      onValueChange?.(newDate);
    } else if (selectedDate) {
      onValueChange?.(selectedDate);
    }
  }

  function handleTimeChange(type: 'ampm' | 'hour' | 'minute', val: string) {
    if (!value) return;

    const newDate = new Date(value);
    if (type === 'hour') {
      const hour12 = parseInt(val);
      const currentHour = newDate.getHours();
      const isPM = currentHour >= 12;
      newDate.setHours(isPM ? (hour12 % 12) + 12 : hour12 % 12);
    } else if (type === 'minute') {
      newDate.setMinutes(parseInt(val));
    } else if (type === 'ampm') {
      const currentHours = newDate.getHours();
      if (val === 'PM' && currentHours < 12) {
        newDate.setHours(currentHours + 12);
      } else if (val === 'AM' && currentHours >= 12) {
        newDate.setHours(currentHours - 12);
      }
    }
    onValueChange?.(newDate);
  }

  return (
    <Popover
      autoWidth
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center overflow-hidden border text-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
            'h-inputHeight text-default border-input bg-panel-input-background px-2 gap-2 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {value ? format(value, 'MM/dd/yyyy hh:mm aa') : placeholder}
        </button>
      }
    >
      <div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            handleDateSelect(date as Date | undefined);
          }}
        />
        {value && (
          <div className="p-3 border-t border-input">
            <div className="grid grid-cols-3 gap-2">
              <ScrollArea className="h-24">
                <div className="flex flex-col gap-1">
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => {
                        handleTimeChange('hour', hour.toString());
                      }}
                      className={cn(
                        'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                        value && parseInt(format(value, 'h')) === hour
                          ? 'bg-primary text-primary-content border-transparent'
                          : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                      )}
                    >
                      {hour.toString()}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <ScrollArea className="h-24">
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => {
                        handleTimeChange('minute', minute.toString());
                      }}
                      className={cn(
                        'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                        value && value.getMinutes() === minute
                          ? 'bg-primary text-primary-content border-transparent'
                          : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                      )}
                    >
                      {minute.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <ScrollArea className="h-24">
                <div className="flex flex-col gap-1">
                  {['AM', 'PM'].map((ampm) => (
                    <button
                      key={ampm}
                      type="button"
                      onClick={() => {
                        handleTimeChange('ampm', ampm);
                      }}
                      className={cn(
                        'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                        value && format(value, 'aa') === ampm
                          ? 'bg-primary text-primary-content border-transparent'
                          : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                      )}
                    >
                      {ampm}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </Popover>
  );
}

// DateTime Picker (24-hour format) Component
export function DateTimePicker24h({
  value,
  onValueChange,
  placeholder = 'Pick a date and time',
  className,
  disabled,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  function handleDateSelect(selectedDate: Date | undefined) {
    if (selectedDate && value) {
      const newDate = new Date(selectedDate);
      newDate.setHours(value.getHours(), value.getMinutes());
      onValueChange?.(newDate);
    } else if (selectedDate) {
      onValueChange?.(selectedDate);
    }
  }

  function handleTimeChange(type: 'hour' | 'minute', val: string) {
    if (!value) return;

    const newDate = new Date(value);
    if (type === 'hour') {
      newDate.setHours(parseInt(val));
    } else if (type === 'minute') {
      newDate.setMinutes(parseInt(val));
    }
    onValueChange?.(newDate);
  }

  return (
    <Popover
      autoWidth
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center overflow-hidden border text-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
            'h-inputHeight text-default border-input bg-panel-input-background px-2 gap-2 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {value ? format(value, 'MM/dd/yyyy HH:mm') : placeholder}
        </button>
      }
    >
      <div>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            handleDateSelect(date as Date | undefined);
          }}
        />
        {value && (
          <div className="p-3 border-t border-input">
            <div className="grid grid-cols-2 gap-2">
              <ScrollArea className="h-24">
                <div className="flex flex-col gap-1">
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => {
                        handleTimeChange('hour', hour.toString());
                      }}
                      className={cn(
                        'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                        value && value.getHours() === hour
                          ? 'bg-primary text-primary-content border-transparent'
                          : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                      )}
                    >
                      {hour.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <ScrollArea className="h-24">
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => {
                        handleTimeChange('minute', minute.toString());
                      }}
                      className={cn(
                        'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                        value && value.getMinutes() === minute
                          ? 'bg-primary text-primary-content border-transparent'
                          : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                      )}
                    >
                      {minute.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </Popover>
  );
}

// DateTime Range Picker Component
export interface DateTimeRangePickerProps {
  value?: { from: Date; to?: Date };
  onValueChange?: (range: { from: Date; to?: Date } | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  format24h?: boolean;
}

export function DateTimeRangePicker({
  value,
  onValueChange,
  placeholder = 'Select date and time range',
  className,
  disabled,
  format24h = false,
}: DateTimeRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const displayText = React.useMemo(() => {
    if (!value?.from) return placeholder;
    const formatStr = format24h ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy hh:mm aa';
    if (!value.to) return format(value.from, formatStr);
    return `${format(value.from, formatStr)} - ${format(value.to, formatStr)}`;
  }, [value, placeholder, format24h]);

  function handleDateRangeSelect(range: { from: Date; to?: Date } | undefined) {
    if (!range) {
      onValueChange?.(undefined);
      return;
    }

    // Preserve existing times when changing dates
    const newRange = { ...range };

    if (value?.from && range.from) {
      newRange.from = new Date(range.from);
      newRange.from.setHours(value.from.getHours(), value.from.getMinutes());
    }

    if (value?.to && range.to) {
      newRange.to = new Date(range.to);
      newRange.to.setHours(value.to.getHours(), value.to.getMinutes());
    }

    onValueChange?.(newRange);
  }

  function handleTimeChange(
    type: 'from' | 'to',
    timeType: 'ampm' | 'hour' | 'minute',
    timeValue: string,
  ) {
    if (!value) return;

    const newRange = { ...value };
    const targetDate = type === 'from' ? newRange.from : newRange.to;

    if (!targetDate) return;

    const newDate = new Date(targetDate);

    if (timeType === 'hour') {
      if (format24h) {
        newDate.setHours(parseInt(timeValue));
      } else {
        const hour12 = parseInt(timeValue);
        const currentHour = newDate.getHours();
        const isPM = currentHour >= 12;
        newDate.setHours(isPM ? (hour12 % 12) + 12 : hour12 % 12);
      }
    } else if (timeType === 'minute') {
      newDate.setMinutes(parseInt(timeValue));
    } else if (timeType === 'ampm' && !format24h) {
      const currentHours = newDate.getHours();
      if (timeValue === 'PM' && currentHours < 12) {
        newDate.setHours(currentHours + 12);
      } else if (timeValue === 'AM' && currentHours >= 12) {
        newDate.setHours(currentHours - 12);
      }
    }

    if (type === 'from') {
      newRange.from = newDate;
    } else {
      newRange.to = newDate;
    }

    onValueChange?.(newRange);
  }

  function TimeSelector({ date, type }: { date: Date; type: 'from' | 'to' }) {
    const hours = format24h
      ? Array.from({ length: 24 }, (_, i) => i)
      : Array.from({ length: 12 }, (_, i) => i + 1);

    return (
      <div className="p-3 border-t border-input">
        <h4 className="text-xs font-medium mb-2 text-text-default">
          {type === 'from' ? 'Start Time' : 'End Time'}
        </h4>
        <div
          className={cn(
            'grid gap-2',
            format24h ? 'grid-cols-2' : 'grid-cols-3',
          )}
        >
          <ScrollArea className="h-20">
            <div className="flex flex-col gap-1">
              {hours.map((hour) => {
                const isSelected = format24h
                  ? date.getHours() === hour
                  : parseInt(format(date, 'h')) === hour;

                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      handleTimeChange(type, 'hour', hour.toString());
                    }}
                    className={cn(
                      'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-content border-transparent'
                        : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                    )}
                  >
                    {format24h
                      ? hour.toString().padStart(2, '0')
                      : hour.toString()}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <ScrollArea className="h-20">
            <div className="flex flex-col gap-1">
              {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => {
                    handleTimeChange(type, 'minute', minute.toString());
                  }}
                  className={cn(
                    'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                    date.getMinutes() === minute
                      ? 'bg-primary text-primary-content border-transparent'
                      : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                  )}
                >
                  {minute.toString().padStart(2, '0')}
                </button>
              ))}
            </div>
          </ScrollArea>
          {!format24h && (
            <ScrollArea className="h-20">
              <div className="flex flex-col gap-1">
                {['AM', 'PM'].map((ampm) => (
                  <button
                    key={ampm}
                    type="button"
                    onClick={() => {
                      handleTimeChange(type, 'ampm', ampm);
                    }}
                    className={cn(
                      'text-xs px-2 py-1 h-biHeight-sm min-h-biHeight-sm border transition-colors',
                      format(date, 'aa') === ampm
                        ? 'bg-primary text-primary-content border-transparent'
                        : 'bg-transparent hover:bg-secondary-hover text-text-default border-input',
                    )}
                  >
                    {ampm}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    );
  }

  return (
    <Popover
      autoWidth
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center overflow-hidden border text-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-content focus-visible:outline-none focus-within:ring-1 focus-within:ring-ring',
            'h-inputHeight text-default border-input bg-panel-input-background px-2 gap-2 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {displayText}
        </button>
      }
    >
      <div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={value}
          onSelect={(range) => {
            handleDateRangeSelect(
              range as { from: Date; to?: Date } | undefined,
            );
          }}
        />
        {value?.from && <TimeSelector date={value.from} type="from" />}
        {value?.to && <TimeSelector date={value.to} type="to" />}
      </div>
    </Popover>
  );
}
