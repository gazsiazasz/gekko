let chai = require('chai');
let expect = chai.expect;
let should = chai.should;
let sinon = require('sinon');

let _ = require('lodash');

let util = require('../../core/util');
let dirs = util.dirs();
let INDICATOR_PATH = dirs.indicators;

// Fake input prices to verify all indicators
// are working correctly by comparing fresh
// calculated results to pre calculated results.

// The precalculated results are already compared
// to MS Excel results, more info here:
//
// https://github.com/askmike/gekko/issues/161

let prices = [81, 24, 75, 21, 34, 25, 72, 92, 99, 2, 86, 80, 76, 8, 87, 75, 32, 65, 41, 9, 13, 26, 56, 28, 65, 58, 17, 90, 87, 86, 99, 3, 70, 1, 27, 9, 92, 68, 9];

describe('indicators/PPO', function() {

  let PPO = require(INDICATOR_PATH + 'PPO');

  let verified_ppo12v26v9 = [0,-5.922297673383055,-5.204813152773915,-10.775104631720897,-13.901816018390623,-17.719369436924076,-14.22599518036208,-8.779001074074772,-3.7775327599722406,-11.79779911287454,-7.3650541223130555,-4.659894802610166,-3.0092688006197794,-10.268186733549467,-5.72296687408477,-3.714833010426942,-7.582596159036941,-6.295429716477546,-8.431243146403258,-14.906489369094212,-19.9673059077387,-21.968696242678835,-18.053100351760996,-19.745285752660987,-14.297565938958984,-11.143819939485432,-15.619787658403148,-6.481364924591247,-0.3633332042639952,3.9025254618963814,8.5325172756507,-0.3918493405267646,1.5323382353294481,-7.05563807597937,-10.289915270521151,-16.28333826120637,-6.14602662946988,-2.589345706109427,-9.383623293044062];
  let verified_ppo12v26v9signal = [0,-1.184459534676611,-1.9885302582960718,-3.745845132981037,-5.777039310062954,-8.16550533543518,-9.37760330442056,-9.257882858351403,-8.161812838675571,-8.889010093515365,-8.584218899274903,-7.799354079941956,-6.8413370240775215,-7.526706965971911,-7.165958947594484,-6.475733760160976,-6.697106239936169,-6.616770935244445,-6.979665377476208,-8.565030175799809,-10.845485322187589,-13.07012750628584,-14.066722075380872,-15.202434810836897,-15.021461036461314,-14.245932817066137,-14.52070378533354,-12.912836013185082,-10.402935451400865,-7.541843268741416,-4.3269711598629925,-3.539946795995747,-2.5254897897307083,-3.431519446980441,-4.8031986116885825,-7.099226541592141,-6.908586559167689,-6.044738388556036,-6.712515369453642];
  let verified_ppo12v26v9hist = [0,-4.737838138706444,-3.2162828944778434,-7.02925949873986,-8.12477670832767,-9.553864101488896,-4.84839187594152,0.47888178427663064,4.3842800787033305,-2.9087890193591743,1.2191647769618479,3.13945927733179,3.832068223457742,-2.7414797675775553,1.4429920735097133,2.760900749734034,-0.8854899191007712,0.32134121876689914,-1.4515777689270495,-6.341459193294403,-9.121820585551113,-8.898568736392996,-3.9863782763801243,-4.54285094182409,0.7238950975023304,3.102112877580705,-1.099083873069608,6.431471088593835,10.03960224713687,11.444368730637798,12.859488435513693,3.1480974554689825,4.057828025060156,-3.6241186289989296,-5.486716658832568,-9.18411171961423,0.762559929697809,3.455392682446609,-2.6711079235904203];

  it('should correctly calculate PPOs with 12/26/9', function() {
    let ppo = new PPO({short: 12, long: 26, signal: 9});
    _.each(prices, function(p, i) {
      ppo.update(p);
      expect(ppo.result.ppo).to.equal(verified_ppo12v26v9[i]);
    });
  });

  it('should correctly calculate PPO signals with 12/26/9', function() {
    let ppo = new PPO({short: 12, long: 26, signal: 9});
    _.each(prices, function(p, i) {
      ppo.update(p);
      expect(ppo.result.PPOsignal).to.equal(verified_ppo12v26v9signal[i]);
    });
  });


  it('should correctly calculate PPO hists with 12/26/9', function() {
    let ppo = new PPO({short: 12, long: 26, signal: 9});
    _.each(prices, function(p, i) {
      ppo.update(p);
      expect(ppo.result.PPOhist).to.equal(verified_ppo12v26v9hist[i]);
    });
  });
});
