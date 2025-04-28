'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">Elvate-Rest-Api documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                        <li class="link">
                            <a href="overview.html" data-type="chapter-link">
                                <span class="icon ion-ios-keypad"></span>Overview
                            </a>
                        </li>
                        <li class="link">
                            <a href="index.html" data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>README
                            </a>
                        </li>
                        <li class="link">
                            <a href="license.html"  data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>LICENSE
                            </a>
                        </li>
                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                                <li class="link">
                                    <a href="properties.html" data-type="chapter-link">
                                        <span class="icon ion-ios-apps"></span>Properties
                                    </a>
                                </li>
                    </ul>
                </li>
                    <li class="chapter modules">
                        <a data-type="chapter-link" href="modules.html">
                            <div class="menu-toggler linked" data-bs-toggle="collapse" ${ isNormalMode ?
                                'data-bs-target="#modules-links"' : 'data-bs-target="#xs-modules-links"' }>
                                <span class="icon ion-ios-archive"></span>
                                <span class="link-name">Modules</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                        </a>
                        <ul class="links collapse " ${ isNormalMode ? 'id="modules-links"' : 'id="xs-modules-links"' }>
                            <li class="link">
                                <a href="modules/AdminModule.html" data-type="entity-link" >AdminModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' : 'data-bs-target="#xs-controllers-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' :
                                            'id="xs-controllers-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' }>
                                            <li class="link">
                                                <a href="controllers/AdminProductController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AdminProductController</a>
                                            </li>
                                            <li class="link">
                                                <a href="controllers/AdminUserController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AdminUserController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' : 'data-bs-target="#xs-injectables-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' :
                                        'id="xs-injectables-links-module-AdminModule-c05cc2e4faec60d97de43eab830fcebb962d2eb7132c5cf86432e59e59e642f0d02b2b7c11a5ba6f03126b7ea73edb0809d79f63edfe2483ff04da370e286220"' }>
                                        <li class="link">
                                            <a href="injectables/AdminUserService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AdminUserService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AppModule.html" data-type="entity-link" >AppModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' : 'data-bs-target="#xs-controllers-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' :
                                            'id="xs-controllers-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' }>
                                            <li class="link">
                                                <a href="controllers/AppController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' : 'data-bs-target="#xs-injectables-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' :
                                        'id="xs-injectables-links-module-AppModule-1886672c40286f7568f4a92e65e286a41559d4bf6fa6b16dc3223cebb5fdeb59553ef8062b6acc5286154b985dd044d9304f47463a3669a1da61c168f2f28d51"' }>
                                        <li class="link">
                                            <a href="injectables/AppService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AppService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/AuthModule.html" data-type="entity-link" >AuthModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' : 'data-bs-target="#xs-controllers-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' :
                                            'id="xs-controllers-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' }>
                                            <li class="link">
                                                <a href="controllers/AuthController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' : 'data-bs-target="#xs-injectables-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' :
                                        'id="xs-injectables-links-module-AuthModule-0de8d4de3e2b8d584723e8879c17bc8d01a54a08ba95575086160ce559ddd13a0f651938470713b2c467ce0e234469f14d0018cbd3c9cf64cc43b7b8799f76d5"' }>
                                        <li class="link">
                                            <a href="injectables/AuthService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >AuthService</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/JwtAuthGuard.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtAuthGuard</a>
                                        </li>
                                        <li class="link">
                                            <a href="injectables/JwtStrategy.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >JwtStrategy</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/ProductsModule.html" data-type="entity-link" >ProductsModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' : 'data-bs-target="#xs-controllers-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' :
                                            'id="xs-controllers-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' }>
                                            <li class="link">
                                                <a href="controllers/ProductController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ProductController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' : 'data-bs-target="#xs-injectables-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' :
                                        'id="xs-injectables-links-module-ProductsModule-7cde64fda775007150b53a7dfca2c8984ee4d0c7db7e0fca86c3fa1bb4be9a064a27cb4986857ec58932acac3ed832306967c299501104f0e5b81617caa96bdd"' }>
                                        <li class="link">
                                            <a href="injectables/ProductService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >ProductService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                            <li class="link">
                                <a href="modules/UsersModule.html" data-type="entity-link" >UsersModule</a>
                                    <li class="chapter inner">
                                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                            'data-bs-target="#controllers-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' : 'data-bs-target="#xs-controllers-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' }>
                                            <span class="icon ion-md-swap"></span>
                                            <span>Controllers</span>
                                            <span class="icon ion-ios-arrow-down"></span>
                                        </div>
                                        <ul class="links collapse" ${ isNormalMode ? 'id="controllers-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' :
                                            'id="xs-controllers-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' }>
                                            <li class="link">
                                                <a href="controllers/UsersController.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UsersController</a>
                                            </li>
                                        </ul>
                                    </li>
                                <li class="chapter inner">
                                    <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ?
                                        'data-bs-target="#injectables-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' : 'data-bs-target="#xs-injectables-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' }>
                                        <span class="icon ion-md-arrow-round-down"></span>
                                        <span>Injectables</span>
                                        <span class="icon ion-ios-arrow-down"></span>
                                    </div>
                                    <ul class="links collapse" ${ isNormalMode ? 'id="injectables-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' :
                                        'id="xs-injectables-links-module-UsersModule-aca8934c33e4103dcbab66f0925261c5032f8f6738e702f9b24974a36edb496b60f9df139c7916c588ccb049f01f06232ead161e817cdf9c91d7b4eb5df6c636"' }>
                                        <li class="link">
                                            <a href="injectables/UsersService.html" data-type="entity-link" data-context="sub-entity" data-context-id="modules" >UsersService</a>
                                        </li>
                                    </ul>
                                </li>
                            </li>
                </ul>
                </li>
                        <li class="chapter">
                            <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#entities-links"' :
                                'data-bs-target="#xs-entities-links"' }>
                                <span class="icon ion-ios-apps"></span>
                                <span>Entities</span>
                                <span class="icon ion-ios-arrow-down"></span>
                            </div>
                            <ul class="links collapse " ${ isNormalMode ? 'id="entities-links"' : 'id="xs-entities-links"' }>
                                <li class="link">
                                    <a href="entities/Product.html" data-type="entity-link" >Product</a>
                                </li>
                                <li class="link">
                                    <a href="entities/Roles.html" data-type="entity-link" >Roles</a>
                                </li>
                                <li class="link">
                                    <a href="entities/Users.html" data-type="entity-link" >Users</a>
                                </li>
                            </ul>
                        </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#classes-links"' :
                            'data-bs-target="#xs-classes-links"' }>
                            <span class="icon ion-ios-paper"></span>
                            <span>Classes</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="classes-links"' : 'id="xs-classes-links"' }>
                            <li class="link">
                                <a href="classes/AdminUpdateUserDto.html" data-type="entity-link" >AdminUpdateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/AdminUserQueryDto.html" data-type="entity-link" >AdminUserQueryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateProductDto.html" data-type="entity-link" >CreateProductDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/CreateUserDto.html" data-type="entity-link" >CreateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/HttpExceptionFilter.html" data-type="entity-link" >HttpExceptionFilter</a>
                            </li>
                            <li class="link">
                                <a href="classes/LoginDto.html" data-type="entity-link" >LoginDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ProductQueryDto.html" data-type="entity-link" >ProductQueryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateProductDto.html" data-type="entity-link" >UpdateProductDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UpdateUserDto.html" data-type="entity-link" >UpdateUserDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserQueryDto.html" data-type="entity-link" >UserQueryDto</a>
                            </li>
                            <li class="link">
                                <a href="classes/ValidationExceptionFilter.html" data-type="entity-link" >ValidationExceptionFilter</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#guards-links"' :
                            'data-bs-target="#xs-guards-links"' }>
                            <span class="icon ion-ios-lock"></span>
                            <span>Guards</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="guards-links"' : 'id="xs-guards-links"' }>
                            <li class="link">
                                <a href="guards/RolesGuard.html" data-type="entity-link" >RolesGuard</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interfaces-links"' :
                            'data-bs-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/JwtPayload.html" data-type="entity-link" >JwtPayload</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PaginatedResponse.html" data-type="entity-link" >PaginatedResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PaginatedResponse-1.html" data-type="entity-link" >PaginatedResponse</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PaginationMeta.html" data-type="entity-link" >PaginationMeta</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PaginationMeta-1.html" data-type="entity-link" >PaginationMeta</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ValidationErrorItem.html" data-type="entity-link" >ValidationErrorItem</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#miscellaneous-links"'
                            : 'data-bs-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/enumerations.html" data-type="entity-link">Enums</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank" rel="noopener noreferrer">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});