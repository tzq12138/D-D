import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CharacterCard } from '../src/client/components/CharacterCard';
import { CharacterImportPanel } from '../src/client/components/CharacterImportPanel';
import { LoadingSpinner } from '../src/client/components/LoadingSpinner';
import { MessageFeed } from '../src/client/components/MessageFeed';
import { RollCard } from '../src/client/components/RollCard';
import { HomePage } from '../src/client/pages/HomePage';
import type { Investigator, Message, RollRequest } from '../src/shared/types';

describe('frontend shell', () => {
  it('renders the home page actions for local demo play', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /COC AI Keeper/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /创建调查房间/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /资料库/ })).toHaveAttribute('href', '/library');
  });

  it('renders the investigator state that matters during play', () => {
    render(<CharacterCard investigator={demoInvestigator} />);

    expect(screen.getByText('温特斯')).toBeInTheDocument();
    expect(screen.getByText('SAN 47/55')).toBeInTheDocument();
    expect(screen.getByText('图书馆使用 60')).toBeInTheDocument();
  });

  it('renders the xlsx character import affordance', () => {
    render(<CharacterImportPanel roomId="room-1" ownerParticipantId="player-1" />);

    expect(screen.getByText(/导入xlsx角色卡/)).toBeInTheDocument();
    expect(screen.getByText(/COC七版整合半自动角色卡/)).toBeInTheDocument();
  });
});

describe('LoadingSpinner', () => {
  it('renders with default label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<LoadingSpinner label="AI思考中..." />);
    expect(screen.getByText('AI思考中...')).toBeInTheDocument();
  });
});

describe('MessageFeed visibility', () => {
  const baseMessage: Message = {
    id: 'msg-1',
    roomId: 'room-1',
    senderName: 'Keeper',
    type: 'keeper',
    text: '公开消息',
    visibility: 'public',
    createdAt: new Date().toISOString()
  };

  const keeperMessage: Message = {
    ...baseMessage,
    id: 'msg-2',
    text: '守秘人笔记',
    visibility: 'keeper'
  };

  const privateForPlayer: Message = {
    ...baseMessage,
    id: 'msg-3',
    text: '私人线索',
    visibility: 'private',
    metadata: { visibleToParticipantIds: ['player-1'] }
  };

  it('keeper sees all messages regardless of visibility', () => {
    render(
      <MessageFeed
        messages={[baseMessage, keeperMessage, privateForPlayer]}
        roomId="room-1"
        viewerRole="keeper"
      />
    );

    expect(screen.getByText('公开消息')).toBeInTheDocument();
    expect(screen.getByText('守秘人笔记')).toBeInTheDocument();
    expect(screen.getByText('私人线索')).toBeInTheDocument();
  });

  it('player sees public messages and their own private messages', () => {
    render(
      <MessageFeed
        messages={[baseMessage, keeperMessage, privateForPlayer]}
        roomId="room-1"
        viewerRole="player"
        viewerParticipantId="player-1"
      />
    );

    expect(screen.getByText('公开消息')).toBeInTheDocument();
    expect(screen.queryByText('守秘人笔记')).not.toBeInTheDocument();
    expect(screen.getByText('私人线索')).toBeInTheDocument();
  });

  it('player cannot see private messages for other participants', () => {
    render(
      <MessageFeed
        messages={[privateForPlayer]}
        roomId="room-1"
        viewerRole="player"
        viewerParticipantId="player-2"
      />
    );

    expect(screen.queryByText('私人线索')).not.toBeInTheDocument();
  });

  it('player cannot see private messages without viewerParticipantId', () => {
    render(
      <MessageFeed
        messages={[privateForPlayer]}
        roomId="room-1"
        viewerRole="player"
      />
    );

    expect(screen.queryByText('私人线索')).not.toBeInTheDocument();
  });
});

describe('RollCard', () => {
  const sampleRequest: RollRequest = {
    id: 'roll-1',
    type: 'skill',
    label: '调查图书馆线索',
    skillName: '图书馆使用',
    suggestedSkills: ['图书馆使用', '侦查'],
    difficulty: 'regular',
    bonusDice: 0,
    penaltyDice: 0,
    reason: '从书架中寻找线索',
    visibility: 'public'
  };

  it('renders roll request info', () => {
    render(<RollCard roomId="room-1" request={sampleRequest} />);

    expect(screen.getByText('调查图书馆线索')).toBeInTheDocument();
    expect(screen.getByText(/图书馆使用/)).toBeInTheDocument();
    expect(screen.getByText(/regular/)).toBeInTheDocument();
  });

  it('shows rolled state when alreadyRolled is true', () => {
    render(<RollCard roomId="room-1" request={sampleRequest} alreadyRolled />);

    expect(screen.getByText('已检定')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows dice button when not rolled', () => {
    render(<RollCard roomId="room-1" request={sampleRequest} />);

    expect(screen.getByText('掷骰')).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

const demoInvestigator: Investigator = {
  id: 'pc-1',
  roomId: 'room-1',
  ownerParticipantId: 'p-1',
  name: '温特斯',
  occupation: '私家侦探',
  age: 42,
  attributes: { STR: 55, CON: 60, SIZ: 65, DEX: 70, APP: 45, INT: 75, POW: 50, EDU: 80 },
  derived: {
    hp: { current: 9, max: 12 },
    san: { current: 47, max: 55 },
    luck: { current: 42, max: 60 },
    mp: { current: 10, max: 10 },
    move: 8,
    damageBonus: '+0',
    build: 0
  },
  skills: { 图书馆使用: 60, 侦查: 70 },
  possessions: ['手电筒'],
  wounds: ['左前臂割伤'],
  conditions: ['偏执'],
  growthMarks: ['侦查']
};
