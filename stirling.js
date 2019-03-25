"use strict";

let st = {};
st.LINEAR = Symbol( 'linear' );
st.EASE_IN = Symbol( 'ease-in' );
st.OVERFLOW_HIDDEN = Symbol( 'overflow-hidden' );
st.OVERFLOW_VISIBLE = Symbol( 'overflow-visible' );
st.EPSILON = 0.01;
st.DEG_TO_RAD = ( Math.PI / 180 );
st._entityID = 0;
st.gameInstance = null;
st.shuffleArray = function( a )
{
    for( let i = a.length - 1; i > 0; i-- )
    {
        let j = Math.floor( Math.random() * ( i + 1 ) );
        let x = a[ j ];
        a[ j ] = a[ i ];
        a[ i ] = x;
    }
};
st.degToRad = function( d )
{
    return ( d * st.DEG_TO_RAD );
};
st.clamp = function( value, min, max )
{
    return Math.min( Math.max( value, min ), max );
}

class Point
{
    constructor( x, y )
    {
        this.x = x || 0;
        this.y = y || 0;
    }

    copy()
    {
        return new Point( this.x, this.y );
    }

    sqDist()
    {
        return ( ( this.x * this.x ) + ( this.y * this.y ) );
    }

    subtract( p )
    {
        return new Point( this.x - p.x, this.y - p.y );
    }

    add( p )
    {
        return new Point( this.x + p.x, this.y + p.y );
    }

    moveBy( x, y )
    {
        this.x += x;
        this.y += y;
    }

    scaleByUniform( s )
    {
        this.x *= s;
        this.y *= s;
    }

    scaleX( sx )
    {
        this.x *= sx;
    }

    scaleY( sy )
    {
        this.y *= sy;
    }

    rotate( r )
    {
        let cosTheta = Math.cos( r );
        let sinTheta = Math.sin( r );

        let newX = ( this.x * cosTheta ) - ( this.y * sinTheta );
        let newY = ( this.y * cosTheta ) + ( this.x * sinTheta );
        this.x = newX;
        this.y = newY;
    }

    rotateDeg( d )
    {
        this.rotate( ( d * st.DEG_TO_RAD ) );
    }

}

class stTween
{
    constructor( value, target, data )
    {
        this.startValue = value;
        this.animatingValue = value;
        this.animTime = 0;
        this.targetValue = target;

        this.easing = st.LINEAR;

        this.direction = 0;
        if( this.targetValue > this.startValue )
        {
            this.direction = 1;
        }
        else if( this.targetValue < this.startValue )
        {
            this.direction = -1;
        }

        this.duration = 1000;
        if( data.hasOwnProperty( 'duration' ) )
        {
            this.duration = data[ 'duration' ] * 1000;
        }

        this.callback = null;
        if( data.hasOwnProperty( 'callback' ) )
        {
            this.finishedCallback = data[ 'callback' ];
        }

        this.updateFunction = null;
        if( data.hasOwnProperty( 'update' ) )
        {
            this.updateFunction = data[ 'update' ];
        }

        this.active = true;
        if( Math.abs( value - target ) < st.EPSILON )
        {
            this.active = false;
        }
    }

    // TODO: add in easing options
    update( dt )
    {
        if( !this.active ) return;

        this.animTime += dt;

        // linear
        let newValue = ( ( this.targetValue - this.startValue ) * ( this.animTime / this.duration ) ) + this.startValue;

        this.animatingValue = newValue;

        if( (this.animTime > this.duration) || (Math.abs(this.animatingValue - this.targetValue) < st.EPSILON) )
        {
            this.animatingValue = this.targetValue;
            this.active = false;

            if( this.finishedCallback != null )
            {
                this.finishedCallback();
            }
        }

        this._maybeUpdate();
    }

    _maybeUpdate()
    {
        if( this.updateFunction !== null )
        {
            this.updateFunction( this.animatingValue );
        }
    }
}

class stEntity
{
    constructor()
    {
        this.pos = new Point();
        this.rotation = 0;
        this._scale = new Point();
        this._scale.x = 1;
        this._scale.y = 1;

        this._id = st._entityID++;

        this._width = 1;
        this._height = 1;

        this.active = true;
        this.totalTime = 0;

        this.parent = null;
        this.children = [];

        this._tweens = [];

        this._zIndex = 0;

        this.debugPoint = null;
    }

    set scale( s )
    {
        this._scale.x = s;
        this._scale.y = s;
    }

    set width( w )
    {
        this._width = w;
    }

    set height( h )
    {
        this._height = h;
    }

    get width()
    {
        return this._width;
    }

    get height()
    {
        return this._height;
    }

    setDebugPoint( x, y )
    {
        this.debugPoint = new Point( x, y );
    }

    clearDebugPoint()
    {
        this.debugPoint = null;
    }

    tweenPos( newX, newY, duration, callback )
    {
        this.tweenPosX( newX, duration, callback );
        this.tweenPosY( newY, duration);
    }

    tweenPosX( newX, duration, callback )
    {
        this._tweens.push( new stTween( this.pos.x, newX, {
            duration: duration,
            update: function( v ) { this.pos.x = v; }.bind( this ),
            callback: callback
        } ) );
    }

    tweenPosY( newY, duration, callback )
    {
        this._tweens.push( new stTween( this.pos.y, newY, {
            duration: duration,
            update: function( v ) { this.pos.y = v; }.bind( this ),
            callback: callback
        } ) );
    }

    tweenRotation( r, duration, callback )
    {
        this._tweens.push( new stTween( this.rotation, r, {
            duration: duration,
            update: function( v ) { this.rotation = v; }.bind( this ),
            callback: callback
        } ) )
    }

    stopAnimation()
    {
        this._tweens = [];
    }

    addChild( e )
    {
        e.zIndex = this.children.length;
        this.children.push( e );
        e.parent = this;

        this.sortChildren();
    }

    removeChild( e )
    {
        let index = -1;
        for( let i = 0; i < this.children.length; i++ )
        {
            if( this.children[ i ]._id == e._id )
            {
                index = i;
                break;
            }
        }

        if( index != -1 )
        {
            this.children.splice( index, 1 );
        }
    }

    set zIndex( z )
    {
        this._zIndex = z;
        if( this.parent != null )
        {
            this.parent.sortChildren();
        }
    }

    sortChildren()
    {
        this.children = this.children.sort( ( a, b ) =>
        {
            return a._zIndex - b._zIndex;
        } );
    }

    setPos( x, y )
    {
        this.pos.x = x;
        this.pos.y = y;
    }

    _updateInternal( dt )
    {
        if( !this.active ) return;

        if( parseFloat( dt ) )
        {
            this.totalTime += dt;

            this.update( dt );

            if( this._tweens.length > 0 )
            {
                this._tweens.forEach( t =>
                {
                    t.update( dt );
                } );
                this._tweens = this._tweens.filter( t => t.active );
            }

            this.children.forEach( c =>
            {
                c._updateInternal( dt );
            } )
        }
    }

    pointInside( p )
    {
        if( p.x < 0 ) return false;
        if( p.y < 0 ) return false;
        if( p.x > this.width ) return false;
        if( p.y > this.height ) return false;

        return true;
    }

    _inverseTransformPoint( p )
    {
        let newPoint = p.copy();
        newPoint.moveBy( -this.pos.x, -this.pos.y );
        newPoint.scaleX( 1 / this._scale.x );
        newPoint.scaleY( 1 / this._scale.y );
        newPoint.rotateDeg( -this.rotation );
        return newPoint;
    }

    _mouseDownInternal( pos )
    {
        let transformedPoint = this._inverseTransformPoint( pos );

        if( this.pointInside( transformedPoint ) )
        {
            this.mouseDown( transformedPoint );

            this.children.forEach( c =>
            {
                c._mouseDownInternal( transformedPoint );
            } );
        }
    }

    _render( ctx )
    {
        if( !this.active ) return;

        ctx.save();

        ctx.translate( this.pos.x, this.pos.y );
        ctx.rotate( st.degToRad( this.rotation ) );
        ctx.scale( this._scale.x, this._scale.y );

        this.render( ctx );

        this.children.forEach( e =>
        {
            e._render( ctx );
        } );

        if( this.debugPoint != null )
        {
            ctx.save();
            ctx.fillStyle = 'rgb(255, 0,0)';
            ctx.strokeStyle = 'rgb(128,128,128)';

            ctx.beginPath();
            ctx.arc( this.debugPoint.x, this.debugPoint.y, 5, 0, Math.PI * 2 );
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        }

        ctx.restore();
    }

    // abstract methods - override!
    mouseDown( pos ) { }
    render( ctx ) { }
    update( dt ) { }

}

class stTextArea extends stEntity
{
    constructor( w, h )
    {
        super();

        this._fontSize = 20;
        this._fontFamily = 'Arial';
        this.font = `${this._fontSize}px ${this._fontFamily}`;
        this._fontAlign = 'left';
        this.color = 'rgb(0,0,0)';

        this.verticalSpacing = 1.4;

        this.textContent = '';
        this._textLines = [];
        this._textDirty = false;
        this.overflow = st.OVERFLOW_VISIBLE;

        this.width = w;
        this.height = h;
        this._totalHeight = -1;

        this._textPosition = 0;
    }

    set textPosition( p )
    {
        this._textPosition = p;
    }

    set scroll( s )
    {
        if( this._totalHeight === -1 ) return;

        this._textPosition = -( ( this._totalHeight - this.height ) * s )
    }

    set width( w )
    {
        this._width = w;
        this._textDirty = true;
    }

    set fontAlign( align )
    {
        this._fontAlign = align;
    }

    set fontSize( s )
    {
        this._fontSize = s;
        this._textDirty = true;
    }

    set fontFamily( f )
    {
        this._fontFamily = f;
        this._textDirty = true;
    }

    set text( newText )
    {
        this.textContent = newText;
        this._textDirty = true;
    }

    _recalcText( ctx )
    {
        this.font = `${this._fontSize}px ${this._fontFamily}`;
        ctx.save();
        ctx.font = this.font;

        this._textLines.length = 0;

        let words = this.textContent.split( ' ' );
        let currentLine = words[ 0 ];
        let testline = currentLine;
        let metrics = null;

        for( let i = 1; i < words.length; i++ )
        {
            testline = currentLine + ' ' + words[ i ];
            metrics = ctx.measureText( testline );
            if( metrics.width > this._width )
            {
                this._textLines.push( currentLine );
                currentLine = words[ i ];
            }
            else
            {
                currentLine = testline;
            }
        }
        this._textLines.push( currentLine );
        this._totalHeight = ( this._textLines.length * this._fontSize * this.verticalSpacing );
        this._textDirty = false;

        ctx.restore();

    }

    render( ctx )
    {
        if( this._textDirty ) this._recalcText( ctx );

        ctx.font = this.font;
        ctx.fillStyle = this.color;
        ctx.textAlign = this._fontAlign;

        let ypos = 0;
        this._textLines.forEach( ( t, i ) =>
        {
            ypos = ( i * this._fontSize * this.verticalSpacing ) + this._textPosition;

            if( this.overflow == st.OVERFLOW_VISIBLE ||
                ( ( ypos >= 0 ) && ( ypos < this.height ) ) )
            {
                ctx.fillText( t, 0, ypos );
            }
        } );
    }
}

class stImageEntity extends stEntity
{
    constructor( imgSrc, origin )
    {
        super();

        this.image = new Image();
        this.image.onload = this._finishLoad.bind( this );
        this.image.src = imgSrc;

        this.rotation = 0;

        this.isLoaded = false;

        this.origin = new Point( 0.5, 0.5 );
        if( origin )
        {
            this.origin.x = st.clamp( origin[ 0 ], 0, 1 );
            this.origin.y = st.clamp( origin[ 1 ], 0, 1 );
        }
    }

    _finishLoad()
    {
        this.isLoaded = true;
        this.width = this.image.width;
        this.height = this.image.height;
        console.log( 'image loaded! ', this.width, this.height );
    }

    // TODO: take transform into account
    pointInside( p )
    {
        if( p.x < -( this.width * this.origin.x ) ) return false;
        if( p.y < -( this.height * this.origin.y ) ) return false;
        if( p.x > ( this.width * ( 1 - this.origin.x ) ) ) return false;
        if( p.y > ( this.height * ( 1 - this.origin.y ) ) ) return false;
        return true;
    }

    _render( ctx )
    {
        if( this.isLoaded )
        {
            ctx.save();

            ctx.translate( this.pos.x, this.pos.y );
            ctx.rotate( st.degToRad( this.rotation ) );
            ctx.scale( this._scale.x, this._scale.y );

            ctx.drawImage( this.image,
                -( this.image.width * this.origin.x ),
                -( this.image.height * this.origin.y ) );

            this.render( ctx );

            this.children.forEach( e =>
            {
                e._render( ctx );
            } );

            ctx.strokeRect( -( this.width * this.origin.x ),
                -( this.height * this.origin.y ), this.width, this.height );

            ctx.restore();
        }
    }
}

class stGame extends stEntity
{
    constructor( canvasElementID )
    {
        super();

        this.canvas = document.getElementById( canvasElementID );
        this.ctx = this.canvas.getContext( "2d" );

        this._bounds = this.canvas.getBoundingClientRect();
        this.width = this._bounds.width;
        this.height = this._bounds.height;

        this.offscreenCanvas = document.createElement( "canvas" );
        this.offscreenCanvas.style.width = this.width;
        this.offscreenCanvas.style.height = this.height;
        this.offscreenCanvas.style.position = "absolute";
        this.offscreenCanvas.style.left = -100000;
        document.body.appendChild( this.offscreenCanvas );
        this.bufferCtx = this.offscreenCanvas.getContext( "2d" );

        this._lastUpdate = -1;

        this.canvas.onmousedown = this._mouseDownInternal.bind( this );
        // this.canvas.onmouseup = this._mouseUpInternal.bind(this);
        // this.canvas.onmousemove = this._mouseMoveInternal.bind(this);

        st.gameInstance = this;

        this._updateInternal( 0 );

    }

    clearBuffer()
    {
        this.bufferCtx.clearRect( 0, 0, this.width, this.height );
    }

    _cleanEventPoint( evt )
    {
        let p = new Point();
        p.x = evt.clientX - this._bounds.x;
        p.y = evt.clientY - this._bounds.y;
        return p;
    }

    _mouseDownInternal( evt )
    {
        let p = this._cleanEventPoint( evt );
        super._mouseDownInternal( p );
    }

    _mouseMoveRaw( evt )
    {
        this.mouseMove( this._cleanEventPoint( evt ), evt );
    }

    _mouseUpRaw( evt )
    {
        this.mouseUp( this._cleanEventPoint( evt ), evt );
    }

    _updateInternal( totalTime )
    {
        let deltaTime = 0;
        if( this._lastUpdate != -1 )
        {
            deltaTime = totalTime - this._lastUpdate;
        }
        this._lastUpdate = totalTime;

        if( deltaTime == deltaTime )
        {
            this.update( deltaTime );

            this.children.forEach( e =>
            {
                e._updateInternal( deltaTime );
            } );
        }

        this.ctx.clearRect( 0, 0, this.width, this.height );
        this._render( this.ctx );

        requestAnimationFrame( this._updateInternal.bind( this ) );
    }
}