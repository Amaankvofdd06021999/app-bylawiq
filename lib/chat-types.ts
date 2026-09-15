import type {UIMessage} from 'ai';
import type {GroundedAnswer,Source} from './ai/citations';
export type AnswerData={answer:GroundedAnswer;sources:Source[]};
export type BylawMessage=UIMessage<never,{answer:AnswerData;progress:{label:string}},never>;
