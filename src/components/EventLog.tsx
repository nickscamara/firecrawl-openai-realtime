import { ArrowUp, ArrowDown } from 'react-feather';

interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

interface EventLogProps {
  events: RealtimeEvent[];
  expandedEvents: { [key: string]: boolean };
  onToggleExpand: (eventId: string) => void;
  formatTime: (timestamp: string) => string;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export const EventLog = ({
  events,
  expandedEvents,
  onToggleExpand,
  formatTime,
  scrollRef,
}: EventLogProps) => {
  return (
    <div className="content-block events">
      <div className="content-block-title">events</div>
      <div className="content-block-body" ref={scrollRef}>
        {!events.length && `awaiting connection...`}
        {events.map((realtimeEvent) => {
          const count = realtimeEvent.count;
          const event = { ...realtimeEvent.event };
          if (event.type === 'input_audio_buffer.append') {
            event.audio = `[trimmed: ${event.audio.length} bytes]`;
          } else if (event.type === 'response.audio.delta') {
            event.delta = `[trimmed: ${event.delta.length} bytes]`;
          }
          return (
            <div className="event" key={event.event_id}>
              <div className="event-timestamp">
                {formatTime(realtimeEvent.time)}
              </div>
              <div className="event-details">
                <div
                  className="event-summary"
                  onClick={() => onToggleExpand(event.event_id)}
                >
                  <div
                    className={`event-source ${
                      event.type === 'error' ? 'error' : realtimeEvent.source
                    }`}
                  >
                    {realtimeEvent.source === 'client' ? (
                      <ArrowUp />
                    ) : (
                      <ArrowDown />
                    )}
                    <span>
                      {event.type === 'error' ? 'error!' : realtimeEvent.source}
                    </span>
                  </div>
                  <div className="event-type">
                    {event.type}
                    {count && ` (${count})`}
                  </div>
                </div>
                {!!expandedEvents[event.event_id] && (
                  <div className="event-payload">
                    {JSON.stringify(event, null, 2)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
