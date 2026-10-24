/**
 * Real-Time Multiplayer Sync for BingouPix
 * Connects multiple devices (PCs, Mobile Phones) and browser tabs across GitHub Pages.
 * Every device/session gets a unique Player ID.
 */

import { BingoCard, ChatMessage, WinnerInfo } from '../types/bingo.ts';

export interface SyncMessage {
  type: 'BUY_CARDS' | 'CHAT' | 'BALL' | 'WINNER' | 'RESET' | 'SYNC_REQUEST' | 'SYNC_STATE';
  senderId: string;
  senderName: string;
  payload: any;
  timestamp: number;
}

type SyncCallback = (msg: SyncMessage) => void;

class MultiplayerSync {
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private listeners: Set<SyncCallback> = new Set();
  public playerId: string;
  public playerName: string;

  constructor() {
    this.playerId = this.initPlayerId();
    this.playerName = this.initPlayerName();
    this.initBroadcastChannel();
    this.initPublicWebSocket();
  }

  private initPlayerId(): string {
    // Generate unique ID per browser session/device
    let id = sessionStorage.getItem('bingoupix_device_player_id');
    if (!id) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const prefix = isMobile ? 'cel' : 'pc';
      const rand = Math.random().toString(36).substring(2, 7);
      id = `${prefix}-${rand}`;
      sessionStorage.setItem('bingoupix_device_player_id', id);
    }
    return id;
  }

  private initPlayerName(): string {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const suffix = this.playerId.split('-').pop()?.toUpperCase() || '1';
    return isMobile ? `Celular #${suffix}` : `PC #${suffix}`;
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('bingoupix_room_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.senderId !== this.playerId) {
            this.notify(event.data);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not available:', err);
      }
    }
  }

  private initPublicWebSocket() {
    // Connect to open WebSocket MQTT or pubsub channel for cross-device synchronization (PC <-> Phone)
    if (typeof window === 'undefined') return;

    try {
      // Connect to HiveMQ public websocket broker over secure WSS
      const wsUrl = 'wss://broker.hivemq.com:8884/mqtt';
      const ws = new WebSocket(wsUrl, 'mqtt');

      ws.onopen = () => {
        // Send MQTT CONNECT packet
        const clientId = `bingoupix-${this.playerId}`;
        const connectPacket = this.buildMqttConnectPacket(clientId);
        ws.send(connectPacket.buffer as ArrayBuffer);

        // SUBSCRIBE to 'bingoupix/global_game'
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const subPacket = this.buildMqttSubscribePacket('bingoupix/global_game');
            ws.send(subPacket.buffer as ArrayBuffer);
          }
        }, 500);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buffer) => {
              this.parseMqttPublish(new Uint8Array(buffer));
            });
          } else if (event.data instanceof ArrayBuffer) {
            this.parseMqttPublish(new Uint8Array(event.data));
          }
        } catch {
          // ignore binary mqtt parsing fallback
        }
      };

      ws.onerror = () => {
        // BroadcastChannel remains active for local tabs
      };

      ws.onclose = () => {
        // Try reconnect after 8s
        setTimeout(() => this.initPublicWebSocket(), 8000);
      };

      this.ws = ws;
    } catch {
      // fallback
    }
  }

  private buildMqttConnectPacket(clientId: string): Uint8Array {
    const proto = 'MQTT';
    const protoLen = proto.length;
    const clientLen = clientId.length;

    const varHeader = [0, protoLen, ...proto.split('').map((c) => c.charCodeAt(0)), 4, 2, 0, 60];
    const payload = [0, clientLen, ...clientId.split('').map((c) => c.charCodeAt(0))];
    const remaining = [...varHeader, ...payload];

    return new Uint8Array([0x10, remaining.length, ...remaining]);
  }

  private buildMqttSubscribePacket(topic: string): Uint8Array {
    const topicLen = topic.length;
    const packetId = [0, 1];
    const payload = [0, topicLen, ...topic.split('').map((c) => c.charCodeAt(0)), 0]; // QoS 0
    const remaining = [...packetId, ...payload];

    return new Uint8Array([0x82, remaining.length, ...remaining]);
  }

  private buildMqttPublishPacket(topic: string, message: string): Uint8Array {
    const topicLen = topic.length;
    const topicBytes = [0, topicLen, ...topic.split('').map((c) => c.charCodeAt(0))];
    const msgBytes = new TextEncoder().encode(message);
    const remaining = [...topicBytes, ...Array.from(msgBytes)];

    return new Uint8Array([0x30, remaining.length, ...remaining]);
  }

  private parseMqttPublish(bytes: Uint8Array) {
    if ((bytes[0] & 0xf0) === 0x30) {
      // PUBLISH packet
      try {
        let offset = 2;
        // Remaining length decoding
        if (bytes[1] > 127) offset = 3;
        const topicLen = (bytes[offset] << 8) | bytes[offset + 1];
        offset += 2 + topicLen;
        const payloadBytes = bytes.slice(offset);
        const payloadStr = new TextDecoder().decode(payloadBytes);
        const msg = JSON.parse(payloadStr) as SyncMessage;

        if (msg && msg.senderId !== this.playerId) {
          this.notify(msg);
        }
      } catch {
        // parse error
      }
    }
  }

  public broadcast(type: SyncMessage['type'], payload: any) {
    const msg: SyncMessage = {
      type,
      senderId: this.playerId,
      senderName: this.playerName,
      payload,
      timestamp: Date.now(),
    };

    // 1. Broadcast locally across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        // ignore
      }
    }

    // 2. Broadcast to external devices via WebSocket MQTT
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const json = JSON.stringify(msg);
        const packet = this.buildMqttPublishPacket('bingoupix/global_game', json);
        this.ws.send(packet.buffer as ArrayBuffer);
      } catch {
        // ignore
      }
    }
  }

  public onMessage(cb: SyncCallback) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(msg: SyncMessage) {
    this.listeners.forEach((cb) => {
      try {
        cb(msg);
      } catch (e) {
        console.error('Sync listener error:', e);
      }
    });
  }
}

export const multiplayerSync = new MultiplayerSync();
