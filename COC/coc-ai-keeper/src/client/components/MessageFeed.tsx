import type { Message, RollRequest } from '../../shared/types';
import { RollCard } from './RollCard';

interface MessageFeedProps {
  messages: Message[];
  roomId: string;
  investigatorId?: string;
  viewerRole?: 'keeper' | 'player';
  viewerParticipantId?: string;
}

export function MessageFeed({
  messages,
  roomId,
  investigatorId,
  viewerRole = 'player',
  viewerParticipantId
}: MessageFeedProps) {
  const resolvedRollIds = new Set(
    messages
      .map((message) => message.metadata?.rollRequestId)
      .filter((id): id is string => typeof id === 'string')
  );

  const visibleMessages = messages.filter((message) => {
    if (message.visibility === 'public') return true;
    if (viewerRole === 'keeper') return true;
    if (message.visibility === 'private') {
      const visibleTo = (message.metadata?.visibleToParticipantIds ?? []) as string[];
      return viewerParticipantId ? visibleTo.includes(viewerParticipantId) : false;
    }
    return false;
  });

  return (
    <div className="feed" aria-label="会话日志">
      {visibleMessages.map((message) => {
        const rollRequest = (message.metadata?.rollRequest ?? undefined) as RollRequest | undefined;
        return (
          <article className={`message message-${message.type}`} key={message.id}>
            <header>
              <strong>{message.senderName}</strong>
              <time>{new Date(message.createdAt).toLocaleTimeString()}</time>
            </header>
            <p>{message.text}</p>
            {rollRequest && (
              <RollCard
                roomId={roomId}
                investigatorId={investigatorId}
                request={rollRequest}
                alreadyRolled={resolvedRollIds.has(rollRequest.id)}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
