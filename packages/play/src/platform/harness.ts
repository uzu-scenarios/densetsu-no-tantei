/**
 * dev harness の席 (1 画面に 3 席を並べた iframe) か。 3 席が同時に鳴ると聞き分けられないので、
 * BGM と語りの声はここでは鳴らさない。
 */
export const isHarnessSeat = new URLSearchParams(window.location.search).has('__dev_player');
