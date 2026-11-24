import { Hand } from 'lucide-react'
import { AudienceCritic } from './AudienceCritic'
import { BoothReferee } from './BoothReferee'
import './cast-comic.css'

export function CastComic() {
  return <>
    <header className="ba-book-title">
      <img src="/bad-actors-wordmark.svg" width="132" height="26" alt="Bad Actors" />
      <h2 id="ba-dialog-title" tabIndex={-1}>The understudy’s handbook</h2>
    </header>
    <ol className="ba-comic-strip" aria-label="How to play">
      <li className="ba-panel-pose">
        <figure aria-hidden="true">
          <span className="ba-cue-scrap">Drinking water</span>
          <img src="/blocking/drink.png" alt="" width="256" height="256" />
          <Hand className="ba-inking-hand" size={29} strokeWidth={2.6} />
        </figure>
        <div><h3>Bend the talent.</h3><p>Read the cue. Drag the joints and props to act it out.</p></div>
      </li>
      <li className="ba-panel-guess">
        <figure aria-hidden="true">
          <span className="ba-panel-balloon">Having a drink?</span>
          <AudienceCritic mood="guess" jaw="open" gesture="hold" />
        </figure>
        <div><h3>Put Stubbs on the spot.</h3><p>Pick <b>Free play</b> or the <b>Timed show</b>. He only sees the pose.</p></div>
      </li>
      <li className="ba-panel-rule">
        <figure aria-hidden="true">
          <BoothReferee mood="correct" />
          <span className="ba-verdict-stamp">DING!</span>
        </figure>
        <div><h3>Face the judge.</h3><p>A hit earns applause. A miss? Adjust the pose. Make him look again.</p></div>
      </li>
    </ol>
  </>
}
