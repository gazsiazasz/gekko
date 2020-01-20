// Redux/vuex inspired reducer, reduces an event into a gekko state.
// NOTE: this is used by the backend as well as the frontend.

let skipInitialEvents = ['marketUpdate'];
let skipLatestEvents = ['marketStart', 'stratWarmupCompleted'];
let trackAllEvents = ['tradeCompleted', 'advice', 'roundtrip'];

let reduce = (state, event) => {
  let type = event.type;
  let payload = event.payload;

  state = {
    ...state,
    latestUpdate: new Date()
  };

  if(trackAllEvents.includes(type)) {
    if(!state.events[type]) {
      state = {
        ...state,
        events: {
          ...state.events,
          [type]: [ payload ]
        }
      }
    } else {
      state = {
        ...state,
        events: {
          ...state.events,
          [type]: [ ...state.events[type], payload ]
        }
      }
    }
  }

  if(!state.events.initial[type] && !skipInitialEvents.includes(type)) {
    state = {
      ...state,
      events: {
        ...state.events,
        initial: {
          ...state.events.initial,
          [type]: payload
        }
      }
    }
  }

  if(!skipLatestEvents.includes(type)) {
    state = {
      ...state,
      events: {
        ...state.events,
        latest: {
          ...state.events.latest,
          [type]: payload
        }
      }
    }
  }

  return state;
};

// export default reduce;
module.exports = reduce;
