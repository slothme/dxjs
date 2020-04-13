import {
  TAKE_LATEST,
  TAKE_EVERY,
  TAKE_LEADING,
  THROTTLE,
  EFFECT_METHODS_KEY,
} from '@dxjs/common/shared';
import { DxModelInterface } from '@dxjs/common/interfaces/dx-model.interface';
import {
  all,
  AllEffect,
  spawn,
  ForkEffect,
  takeLatest,
  takeEvery,
  takeLeading,
  throttle,
} from 'redux-saga/effects';
import { EffectTypeInterface } from '@dxjs/common/interfaces/dx-effect-type.interface';

export function createSaga(model: DxModelInterface): () => Generator<AllEffect<ForkEffect>> {
  // TODO: effect 增强器优先级降低，后期再重构
  const Model = model.constructor;
  const effectMates = Reflect.getMetadata(EFFECT_METHODS_KEY, Model) as Set<EffectTypeInterface>;

  const effects = [...effectMates].map(effectItem => {
    const effect = model[effectItem.name as string];
    return spawn(function*() {
      switch (effectItem.helperType) {
        case TAKE_EVERY:
          yield takeEvery(effectItem.actionType, effect);
          break;
        case TAKE_LATEST:
          yield takeLatest(effectItem.actionType, effect);
          break;
        case TAKE_LEADING:
          yield takeLeading(effectItem.actionType, effect);
          break;
        case THROTTLE:
          yield throttle(effectItem.value[0] ?? 350, effectItem.actionType, effect);
          break;
        default:
          yield takeEvery(effectItem.actionType, effect);
          break;
      }
    });
  });

  return function* saga(): Generator<AllEffect<ForkEffect>> {
    yield all(effects);
  };
}
