/**
 * Voice Feature
 *
 * Text-to-Speech (TTS), Speech-to-Text (STT), and wake word detection.
 * Supports ElevenLabs, OpenAI Whisper, and local providers.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Voice feature configuration */
export interface VoiceConfig {
  enabled: boolean;
  provider: 'elevenlabs' | 'openai' | 'local';
  voice: string;
  model: string;
  sttProvider: 'whisper' | 'google' | 'local';
  wakeWord?: string;
  apiKey?: string;
}

/** TTS request parameters */
export interface TTSRequest {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

/** TTS response */
export interface TTSResponse {
  audio: Buffer;
  format: string;
  duration: number;
  provider: string;
}

/** STT request parameters */
export interface STTRequest {
  audio: Buffer;
  language?: string;
  format?: 'wav' | 'mp3' | 'ogg' | 'flac';
}

/** STT response */
export interface STTResponse {
  text: string;
  confidence: number;
  language?: string;
  duration: number;
}

/** TTS provider interface */
interface TTSProvider {
  synthesize(request: TTSRequest): Promise<TTSResponse>;
}

/** STT provider interface */
interface STTProvider {
  transcribe(request: STTRequest): Promise<STTResponse>;
}

/**
 * Voice feature — TTS, STT, and wake word detection.
 *
 * Provides audio synthesis and transcription capabilities
 * with pluggable provider backends.
 */
class VoiceFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'voice',
    version: '0.1.0',
    description: 'Text-to-Speech, Speech-to-Text, and wake word detection',
    dependencies: [],
  };

  private config: VoiceConfig = {
    enabled: false,
    provider: 'elevenlabs',
    voice: 'default',
    model: 'eleven_multilingual_v2',
    sttProvider: 'whisper',
  };
  private ctx!: FeatureContext;
  private ttsProvider: TTSProvider | null = null;
  private sttProvider: STTProvider | null = null;
  private wakeWordActive = false;

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<VoiceConfig>) };
    this.ctx.logger.info('Voice feature initialized', {
      provider: this.config.provider,
      sttProvider: this.config.sttProvider,
    });
  }

  async start(): Promise<void> {
    this.ttsProvider = this.createTTSProvider();
    this.sttProvider = this.createSTTProvider();

    if (this.config.wakeWord) {
      this.wakeWordActive = true;
      this.ctx.logger.info('Wake word detection enabled', { wakeWord: this.config.wakeWord });
    }

    this.ctx.logger.info('Voice feature active');
  }

  async stop(): Promise<void> {
    this.wakeWordActive = false;
    this.ttsProvider = null;
    this.sttProvider = null;
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.ttsProvider !== null && this.sttProvider !== null,
      details: {
        ttsProvider: this.config.provider,
        sttProvider: this.config.sttProvider,
        wakeWordActive: this.wakeWordActive,
      },
    };
  }

  /** Convert text to speech audio */
  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    if (!this.ttsProvider) {
      throw new Error('TTS provider not initialized');
    }
    return this.ttsProvider.synthesize(request);
  }

  /** Transcribe audio to text */
  async speechToText(request: STTRequest): Promise<STTResponse> {
    if (!this.sttProvider) {
      throw new Error('STT provider not initialized');
    }
    return this.sttProvider.transcribe(request);
  }

  /** Check if wake word was detected in audio */
  async detectWakeWord(audio: Buffer): Promise<boolean> {
    if (!this.wakeWordActive || !this.config.wakeWord) return false;
    // Wake word detection implementation would go here
    // This is a framework stub — actual implementation depends on chosen model
    return false;
  }

  /** Create TTS provider based on config */
  private createTTSProvider(): TTSProvider {
    switch (this.config.provider) {
      case 'elevenlabs':
        return new ElevenLabsTTSProvider(this.config);
      case 'openai':
        return new OpenAITTSProvider(this.config);
      case 'local':
        return new LocalTTSProvider(this.config);
      default:
        throw new Error(`Unknown TTS provider: ${this.config.provider}`);
    }
  }

  /** Create STT provider based on config */
  private createSTTProvider(): STTProvider {
    switch (this.config.sttProvider) {
      case 'whisper':
        return new WhisperSTTProvider(this.config);
      case 'google':
        return new GoogleSTTProvider(this.config);
      case 'local':
        return new LocalSTTProvider(this.config);
      default:
        throw new Error(`Unknown STT provider: ${this.config.sttProvider}`);
    }
  }
}

/** ElevenLabs TTS provider */
class ElevenLabsTTSProvider implements TTSProvider {
  constructor(private config: VoiceConfig) {}

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const apiKey = this.config.apiKey ?? process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voice = request.voice ?? this.config.voice;
    const model = request.model ?? this.config.model;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: request.text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return {
      audio,
      format: 'mp3',
      duration: 0, // Would need audio analysis for actual duration
      provider: 'elevenlabs',
    };
  }
}

/** OpenAI TTS provider */
class OpenAITTSProvider implements TTSProvider {
  constructor(private config: VoiceConfig) {}

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: request.text,
        voice: request.voice ?? 'alloy',
        response_format: request.format ?? 'mp3',
        speed: request.speed ?? 1.0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS error: ${response.status}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return {
      audio,
      format: request.format ?? 'mp3',
      duration: 0,
      provider: 'openai',
    };
  }
}

/** Local TTS provider (stub) */
class LocalTTSProvider implements TTSProvider {
  constructor(private config: VoiceConfig) {}

  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    // Local TTS would use something like Piper or Coqui TTS
    throw new Error('Local TTS provider not yet implemented');
  }
}

/** Whisper STT provider */
class WhisperSTTProvider implements STTProvider {
  constructor(private config: VoiceConfig) {}

  async transcribe(request: STTRequest): Promise<STTResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured for Whisper');
    }

    const formData = new FormData();
    const blob = new Blob([request.audio], { type: `audio/${request.format ?? 'wav'}` });
    formData.append('file', blob, `audio.${request.format ?? 'wav'}`);
    formData.append('model', 'whisper-1');
    if (request.language) formData.append('language', request.language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json() as { text: string };
    return {
      text: data.text,
      confidence: 1.0,
      language: request.language,
      duration: 0,
    };
  }
}

/** Google STT provider (stub) */
class GoogleSTTProvider implements STTProvider {
  constructor(private config: VoiceConfig) {}

  async transcribe(request: STTRequest): Promise<STTResponse> {
    throw new Error('Google STT provider not yet implemented');
  }
}

/** Local STT provider (stub) */
class LocalSTTProvider implements STTProvider {
  constructor(private config: VoiceConfig) {}

  async transcribe(request: STTRequest): Promise<STTResponse> {
    throw new Error('Local STT provider not yet implemented');
  }
}

export default new VoiceFeature();
