# Changelog

## [1.7.0](https://github.com/systembugtj/picasa-vue/compare/v1.6.0...v1.7.0) (2025-09-27)

### Features

- **MaLiang Image Processing Engine**: Implement unified image processing engine with Magic Brush Workshop Pattern
    - Add BmpBrush for BMP format support with Jimp preprocessing
    - Add SharpBrush for universal image processing (JPEG, PNG, WebP, TIFF, GIF, AVIF)
    - Add FfmpegBrush for universal video processing (MP4, AVI, MOV, MKV, WebM, etc.)
    - Implement intelligent format routing based on technical boundaries
- **Architecture Simplification**: Streamline processing architecture from format-specific to technology-boundary-driven design
- **Configuration Management**: Integrate FFmpeg configuration management into engine architecture
- **Code Cleanup**: Remove redundant image processing logic and optimize thumbnail generation workflow

### Bug Fixes

- Fix TypeScript type definitions for ThumbnailOptions interface
- Resolve FFmpeg path configuration issues across development and production environments
- Fix BMP format processing with proper Jimp-to-Sharp preprocessing pipeline

### Performance

- Optimize thumbnail generation by unifying processing through MaLiang engine
- Reduce code duplication and improve maintainability
- Implement lazy loading for FFmpeg configuration

### BREAKING CHANGES

- Thumbnail processing now routes through MaLiang engine for all supported formats
- FFmpeg configuration moved from main/utils to engines/maliang/brushes/video directory
- Legacy direct Sharp processing replaced with MaLiang SharpBrush for consistency

## [1.6.0](https://github.com/systembugtj/picasa-vue/compare/v1.5.0...v1.6.0) (2025-07-05)

### Features

- add release please upload best practice ([ed6e9fc](https://github.com/systembugtj/picasa-vue/commit/ed6e9fcc6851f206a53ed224081a6a750337a55c))

## [1.5.0](https://github.com/systembugtj/picasa-vue/compare/v1.4.0...v1.5.0) (2025-07-05)

### Features

- add release please upload best practice ([e7f7eb4](https://github.com/systembugtj/picasa-vue/commit/e7f7eb4e7dea32f4296bf7d5816dde85e646e654))

## [1.4.0](https://github.com/systembugtj/picasa-vue/compare/v1.3.0...v1.4.0) (2025-07-05)

### Features

- add photasa config modal ([d179d80](https://github.com/systembugtj/picasa-vue/commit/d179d80dbd75ca9535f3c749587ad5b12b6b97b3))

## [1.3.0](https://github.com/systembugtj/picasa-vue/compare/v1.2.0...v1.3.0) (2025-07-05)

### Features

- add empty state ([edb64e9](https://github.com/systembugtj/picasa-vue/commit/edb64e976d1b92c6c2f6c42a9d94610c1c2691b0))

## [1.2.0](https://github.com/systembugtj/picasa-vue/compare/v1.1.0...v1.2.0) (2025-07-05)

### Features

- googleapis/release-please-action@v4 ([21f2bcb](https://github.com/systembugtj/picasa-vue/commit/21f2bcb59665c4efd3187548ede8445a56ddbadc))

## [1.1.0](https://github.com/systembugtj/picasa-vue/compare/v1.0.0...v1.1.0) (2025-07-05)

### Features

- about page ([f1644f6](https://github.com/systembugtj/picasa-vue/commit/f1644f623aba21380d42898dbcc79df2d4d67a51))
- about page ([0d7bea1](https://github.com/systembugtj/picasa-vue/commit/0d7bea1e5f1630eadef6ce2c3b9c725185283a24))
- add icon and add delete ([0358959](https://github.com/systembugtj/picasa-vue/commit/03589593347c3674b9f6841d0528c1c7bde6f64a))
- add loading state and skeleton list ([9a153ae](https://github.com/systembugtj/picasa-vue/commit/9a153ae29448060bfd983f187d3c8d9bb1bc7d8f))
- add pinia ([272adf6](https://github.com/systembugtj/picasa-vue/commit/272adf60485e362768adbe66243669b2059b1a18))
- add pinia store ([fc8a64f](https://github.com/systembugtj/picasa-vue/commit/fc8a64fe93db1ed9d105a0af40dffdfd064730d0))
- add release workflow ([05c4ef7](https://github.com/systembugtj/picasa-vue/commit/05c4ef74e63865034897e55cbe379f1b8d7f552f))
- add split view ([4acccf2](https://github.com/systembugtj/picasa-vue/commit/4acccf2a6329c1d461355a9049df920d7de45da5))
- add thumbnail ([523c55c](https://github.com/systembugtj/picasa-vue/commit/523c55c25a1ec78c8b396854d07176c1792bdcc2))
- add treeview ([059f107](https://github.com/systembugtj/picasa-vue/commit/059f107bff5228351b2b74ec172b133007cebf27))
- add worker pool and error handling system - Add worker pool, error handling, batch processor, and tests ([b77837f](https://github.com/systembugtj/picasa-vue/commit/b77837f6b1c2beccb07d9aae56619768a10e5de1))
- adjust split view init size ([b58ce5c](https://github.com/systembugtj/picasa-vue/commit/b58ce5ca3f77420cff184e2787fa161ed168c523))
- adjust thumbnail size ([fb67332](https://github.com/systembugtj/picasa-vue/commit/fb67332c5fb241c486545363bc2344a6a929d0ca))
- adjust ui ([1af9e88](https://github.com/systembugtj/picasa-vue/commit/1af9e88e342ca4092c95d177984eb87539263a90))
- bugsnag electron ([3c4c7fd](https://github.com/systembugtj/picasa-vue/commit/3c4c7fd607d157bc64432d0485ffcd5237da556e))
- **bugsnag:** add context metadata and breadcrumbs for improved error tracking ([03d8fc9](https://github.com/systembugtj/picasa-vue/commit/03d8fc9a872149c2dadf69a8e1651f829a7791ce))
- build tree node from path ([da1187d](https://github.com/systembugtj/picasa-vue/commit/da1187da1d3b258cd19007583c237d76810d6763))
- click tree node, will filter image list. ([3f1297c](https://github.com/systembugtj/picasa-vue/commit/3f1297cd82a18fe5f1847ce638b52c1f705511da))
- DI ([6da904f](https://github.com/systembugtj/picasa-vue/commit/6da904f425f389b1b9822546b36ae598924019cb))
- folder list align with image list ([34c348d](https://github.com/systembugtj/picasa-vue/commit/34c348d1a9ef7781ae54b98f77d5f47727691778))
- generate thumbnail ([2ce8b62](https://github.com/systembugtj/picasa-vue/commit/2ce8b626bacdfb320874bfd6749afba950cc1aee))
- get info with card ([54b4e08](https://github.com/systembugtj/picasa-vue/commit/54b4e08bded5ba8f9ee34f496e5f0bbb196c44ce))
- i18n ([4481622](https://github.com/systembugtj/picasa-vue/commit/448162213c2dd3b2d45198b4f9ebfe2b80ed6fd8))
- i18n ([a41b2bf](https://github.com/systembugtj/picasa-vue/commit/a41b2bfd699b9495955937b91b47f55411267926))
- **i18n:** add full key coverage and Spanish support for all languages, use 'Photasa' as app name ([97da154](https://github.com/systembugtj/picasa-vue/commit/97da154dc9106a835b30fe070c33de476053e918))
- **i18n:** update Resources section in all supported languages ([dd99f09](https://github.com/systembugtj/picasa-vue/commit/dd99f099202a86cceb3124c2f45b2dc064042f2c))
- import photos to watching folder ([48fd2ab](https://github.com/systembugtj/picasa-vue/commit/48fd2ab75b1b8252bac177e5cba36f9e25a88042))
- persist watch folders ([00eedcc](https://github.com/systembugtj/picasa-vue/commit/00eedcc72652e500452bf724f6ebd6dbf86ef56c))
- refactor file config ([9026308](https://github.com/systembugtj/picasa-vue/commit/902630892828fbaf933681d5ab45ae7c4a8b3a59))
- refactor lazy image ([7c50ee2](https://github.com/systembugtj/picasa-vue/commit/7c50ee296f9c1f26ad75b76e6a46903a076a6d8a))
- refactor path helper ([ddd4355](https://github.com/systembugtj/picasa-vue/commit/ddd43552c5a61381142b94e115c0e0fec9ef19c6))
- refactor path helper ([1e56050](https://github.com/systembugtj/picasa-vue/commit/1e560501a23c96207ef54d249bda31bad0e94ad2))
- refactor path helper ([606e484](https://github.com/systembugtj/picasa-vue/commit/606e484f10acbd10e3511116aa235659964ce087))
- reset ([069e60f](https://github.com/systembugtj/picasa-vue/commit/069e60fa8772e88d1511099cb105f9517925b88c))
- reset ([262e739](https://github.com/systembugtj/picasa-vue/commit/262e739b3a2c4dafe33aa9429d521cf71e3b3a92))
- reset ([91067f6](https://github.com/systembugtj/picasa-vue/commit/91067f6a1e7f31ef50eb6075bf185af787d7cb5e))
- set default ([0c67dee](https://github.com/systembugtj/picasa-vue/commit/0c67dee591acb2f07c8b95f175589059d4485a47))
- show file at footer ([1f6e1e6](https://github.com/systembugtj/picasa-vue/commit/1f6e1e6192e00317390c5049b75ac14214ecfa45))
- show images security is disabled ([36aba05](https://github.com/systembugtj/picasa-vue/commit/36aba05cbbb1acbc351e6b3f5d83a54acc0313be))
- step one add file to tree for render ([4a3d190](https://github.com/systembugtj/picasa-vue/commit/4a3d1903de0f540099ec4d4b3728c634b467f320))
- store path and thumbnail ([#7](https://github.com/systembugtj/picasa-vue/issues/7)) ([4740756](https://github.com/systembugtj/picasa-vue/commit/4740756db44c4c34d1f010491e782b067f1e13ed))
- thumbnail ([eba39b8](https://github.com/systembugtj/picasa-vue/commit/eba39b83770538ceccd05416cfca3b683631d9fa))
- title bar ([b5ba756](https://github.com/systembugtj/picasa-vue/commit/b5ba7563cea5ca958c54863badb3e0d2a9951843))
- tree item meun ([800d715](https://github.com/systembugtj/picasa-vue/commit/800d71507a67b205f7234b7d0ae8f62a5989e6c5))
- use component with props/emit ([6686713](https://github.com/systembugtj/picasa-vue/commit/6686713914090e2358ec9dc8bd80338671a196d9))
- video player ([0519f5e](https://github.com/systembugtj/picasa-vue/commit/0519f5e0f252aa17d9c2a6904dd1027bb71717ff))
- when import, add file to list ([17a0ac8](https://github.com/systembugtj/picasa-vue/commit/17a0ac8f34b6dacd883774cc5353cd7206a62d93))

### Bug Fixes

- about page ([8b21ac2](https://github.com/systembugtj/picasa-vue/commit/8b21ac223a77613f3fbc6fa672ec1ff86503eb7c))
- add file ([0317fcf](https://github.com/systembugtj/picasa-vue/commit/0317fcff810391f3abf5e9c7232a339d2c4823d3))
- add file handleing ([de00494](https://github.com/systembugtj/picasa-vue/commit/de0049475d54a553e8bd72dc329dc25631eca59b))
- add html lang ([45fff84](https://github.com/systembugtj/picasa-vue/commit/45fff846720bca3082cf5d44622e68335f0c299f))
- add image info ([8ae5df9](https://github.com/systembugtj/picasa-vue/commit/8ae5df9211fdcc6ecbe983ef335428ee4f558bb3))
- add libs ([299d361](https://github.com/systembugtj/picasa-vue/commit/299d361898674b483bfb877d84ec9df9cb8618d2))
- add log ([16fe677](https://github.com/systembugtj/picasa-vue/commit/16fe677d0f17c7dc33389f58dd22b3ff5807c0dc))
- add missing pacakge ([149b3f7](https://github.com/systembugtj/picasa-vue/commit/149b3f795494f8d66b6672e7f812ff2472040cdd))
- add path aliases to tsconfig.node.json for module resolution ([51f178e](https://github.com/systembugtj/picasa-vue/commit/51f178e547f2bcacce715bf283f5f002f1db911e))
- add tree handle (+1 squashed commit) ([92d1065](https://github.com/systembugtj/picasa-vue/commit/92d1065975f40520d4ec83b5c9ca12ff18931e30))
- add vuetify ([119a3f5](https://github.com/systembugtj/picasa-vue/commit/119a3f55a060e25bd50c0cfbf28422b1978cb120))
- adjust folder ([8e563f0](https://github.com/systembugtj/picasa-vue/commit/8e563f0a5b800d2fc8a376b999ea6668c19c35d2))
- adjust layout and add menu ([9181c74](https://github.com/systembugtj/picasa-vue/commit/9181c74c49f52df1fbed92d1e4971b630c2dc2e1))
- adjust width ([1751383](https://github.com/systembugtj/picasa-vue/commit/175138313132f9e30fed50f78fc4f5f12d37e3bb))
- align param ([df99c49](https://github.com/systembugtj/picasa-vue/commit/df99c496a7e73d2284289e74fa8cd9e9e1b71d7c))
- align param ([3127572](https://github.com/systembugtj/picasa-vue/commit/3127572530bc1ddeb522e87cb214312ad73b3c1d))
- align param ([e1729a7](https://github.com/systembugtj/picasa-vue/commit/e1729a7c29b2de908ad7b9e49d522be17a9148c7))
- avoid duo ([f45e44c](https://github.com/systembugtj/picasa-vue/commit/f45e44c7e3e75fc85791e9e46731097385054688))
- avoid dup ([498b9b1](https://github.com/systembugtj/picasa-vue/commit/498b9b1c27be57924e5949ac826e8c0e2547080f))
- avoid generate config again ([32c8649](https://github.com/systembugtj/picasa-vue/commit/32c864954d075ea58abb00944b74e209a907723c))
- better name ([6e1ff19](https://github.com/systembugtj/picasa-vue/commit/6e1ff1904486c87b71919a9f1802b683881f16b5))
- build mac ([c566f2d](https://github.com/systembugtj/picasa-vue/commit/c566f2dd70d60eba8d75bab71c2d2fb0111e4e3a))
- build tree node ([bbddb61](https://github.com/systembugtj/picasa-vue/commit/bbddb61d444c2815bc912f790c4519d4cd03dec5))
- build-matrix.yml ([08f2dc8](https://github.com/systembugtj/picasa-vue/commit/08f2dc89d8e13ba0200e2fd97fafb5a439d7a179))
- check if count isn't changed then save it ([af682d8](https://github.com/systembugtj/picasa-vue/commit/af682d8c76347542043c613ae72c3c5a5ea59656))
- clean up ([d8b3ed5](https://github.com/systembugtj/picasa-vue/commit/d8b3ed59e868ea9fe046aa01f859d4b8a4e77cc6))
- clean up ([115fa26](https://github.com/systembugtj/picasa-vue/commit/115fa26173a831d3c7ba4f24feeeb0049dea5cf8))
- clean up ([f456ea2](https://github.com/systembugtj/picasa-vue/commit/f456ea2b68960fb9ff0f106572001f7a6cdbc5bd))
- clean up yarn ([da87888](https://github.com/systembugtj/picasa-vue/commit/da878882fc0dded0d717bb5346604ec5134c46ae))
- close fs watcher ([48f4c66](https://github.com/systembugtj/picasa-vue/commit/48f4c662b307daa00caa6242165208a21dc1d0e7))
- config-cache ([f85d4aa](https://github.com/systembugtj/picasa-vue/commit/f85d4aa504bbb93bb111c687a64fbd1c766016b5))
- create video screenshot ([5d1d2a3](https://github.com/systembugtj/picasa-vue/commit/5d1d2a3d70c8fa478abd4097a11b4d373b4b4107))
- css styling ([bdc92cf](https://github.com/systembugtj/picasa-vue/commit/bdc92cf0b49903f824f836b1d85dc105debe3acb))
- customized title bar, enable drag ([9fd832b](https://github.com/systembugtj/picasa-vue/commit/9fd832b2bca9ef678f2cd363e6705082ad8b653c))
- dark mode ([7d3230b](https://github.com/systembugtj/picasa-vue/commit/7d3230b6cb5f92228ee7255e70e4b104bd427564))
- delete folder should clean folder tree ([4ef4416](https://github.com/systembugtj/picasa-vue/commit/4ef4416af4d5368c3c615137148c8daf99c54e05))
- disable persist ([3130734](https://github.com/systembugtj/picasa-vue/commit/313073458dbad5eae4a0947a84dd2f8e6b13edae))
- don't append children's file to parent (perf) ([a6407e6](https://github.com/systembugtj/picasa-vue/commit/a6407e602e6d11269a480cf33473913f81950c9c))
- dup key ([af58036](https://github.com/systembugtj/picasa-vue/commit/af580364eea4fcb8a8a87b3c4c03d670a333df46))
- ensure preload script reloads properly on page refresh - Add explicit nodeIntegration and contextIsolation settings - Add did-finish-load handler to check and reload if preload script is missing - Fix runtime error where window.api is undefined after page refresh ([910c945](https://github.com/systembugtj/picasa-vue/commit/910c945471879cf2eb56b3120d8de6d99e2529a8))
- file from watch added to .photasa.json ([05b7955](https://github.com/systembugtj/picasa-vue/commit/05b79552cf5a009ee1dc6ab74b3e71feeec3d023))
- folder handling ([fe7e0be](https://github.com/systembugtj/picasa-vue/commit/fe7e0bed9ead88ee4708b70f3dfd4c85fe1e0762))
- folder list height ([1034e3b](https://github.com/systembugtj/picasa-vue/commit/1034e3beb4f98d797d9543957dac3ebf17965c56))
- folder monitor ([6c36c21](https://github.com/systembugtj/picasa-vue/commit/6c36c219d3df853a50ae33f9a60e5128178f7f5f))
- format ([026bec7](https://github.com/systembugtj/picasa-vue/commit/026bec772d732bb0c95cb21af501bd6e5ce42b8b))
- format ([147544e](https://github.com/systembugtj/picasa-vue/commit/147544eba3a669bfd7b819edab3a418e19489287))
- handle delete ([83af83b](https://github.com/systembugtj/picasa-vue/commit/83af83b2c8a5e41365a00b377c005b66979390b0))
- handle delete ([b41e690](https://github.com/systembugtj/picasa-vue/commit/b41e6906b96ba4fc065fc197c94926a580c23dda))
- handle heic with heic-convert ([6827108](https://github.com/systembugtj/picasa-vue/commit/6827108c587f4cc8d04d174200e91ce8ea8bd789))
- i18n ([09e9665](https://github.com/systembugtj/picasa-vue/commit/09e9665c50cc2c7b48695a208947a58103f1c16a))
- **i18n:** use Pinia as single source of truth for locale, remove localStorage logic, ensure language persists after refresh ([dd27c3c](https://github.com/systembugtj/picasa-vue/commit/dd27c3c9e77e881ecbdc08148f1a9defe0dd55ac))
- icon ([a03b50b](https://github.com/systembugtj/picasa-vue/commit/a03b50bd8cab37327bf3812a25331984624a80ba))
- icon ([3b0dae7](https://github.com/systembugtj/picasa-vue/commit/3b0dae76fb4d29f85c15829013c470788759c09c))
- ignore . prefix file ([f2b1faa](https://github.com/systembugtj/picasa-vue/commit/f2b1faa4d6349bb00cef3e75cfada52da197297c))
- ignore monitor .picasaoriginals ([73edc3c](https://github.com/systembugtj/picasa-vue/commit/73edc3cf05e528a86b0e500a9843dc9a8c7d0101))
- image center ([8616e9c](https://github.com/systembugtj/picasa-vue/commit/8616e9c56ea67308e298190fc13e3a4ea0a26571))
- image list not showing up ([c96dc85](https://github.com/systembugtj/picasa-vue/commit/c96dc85affda6842fab6a0f0bfddec5fa6c99a40))
- import photos tweak ([76d52e6](https://github.com/systembugtj/picasa-vue/commit/76d52e6554467fae4ab7f2d22c94c5548253e85b))
- include Vue files in tsconfig.web.json ([df770b1](https://github.com/systembugtj/picasa-vue/commit/df770b1fc19abd7ecea90b43b1708d63f4385bf5))
- laod config at start ([d04d749](https://github.com/systembugtj/picasa-vue/commit/d04d749ef9a90da82a59da0cb1e065d1b45de781))
- lazy image and queue image loading ([dd581df](https://github.com/systembugtj/picasa-vue/commit/dd581df6e23572b07d6891d7745b3e109bf4dea5))
- lint ([4ca8d45](https://github.com/systembugtj/picasa-vue/commit/4ca8d457dcda631bd99d88643b0a3d01273aba36))
- lint ([8ed702d](https://github.com/systembugtj/picasa-vue/commit/8ed702df25a7f3d105427224947edca7319cbc77))
- lint ([74618a1](https://github.com/systembugtj/picasa-vue/commit/74618a1a5d0b4cdf1a7b370e3ddc0ff82758c813))
- lint run issue ([68c2646](https://github.com/systembugtj/picasa-vue/commit/68c2646b8f1d91053c001b549eb154a5febcedec))
- lint run issue ([31f3e50](https://github.com/systembugtj/picasa-vue/commit/31f3e504e3f47ebca9abb68347240d6256c7fd41))
- lint run issue ([adb14bd](https://github.com/systembugtj/picasa-vue/commit/adb14bd2978007b1c38529f1788c3dd417e8cc6e))
- load config instead of file list ([4701192](https://github.com/systembugtj/picasa-vue/commit/47011928511f94c2027aa20cc0fc242c5268fac5))
- logger ([6b38a7a](https://github.com/systembugtj/picasa-vue/commit/6b38a7a988796469a734821697274293956fec62))
- more test ([cfa679c](https://github.com/systembugtj/picasa-vue/commit/cfa679c3b89db6e209654df0eff371132ee3b7d0))
- move package to dependencies for bundle ([ee7880a](https://github.com/systembugtj/picasa-vue/commit/ee7880a001d8dd4144288f85915627586b1f9899))
- move to api.ts ([2cebd6d](https://github.com/systembugtj/picasa-vue/commit/2cebd6d765adb6d4ec8e0b536d0f54a992b9671b))
- move to api.ts ([c2ab57e](https://github.com/systembugtj/picasa-vue/commit/c2ab57ee1df4c317a6e23f8799b87ebba06f5819))
- move to node worker ([1485c70](https://github.com/systembugtj/picasa-vue/commit/1485c70f8dbd78f90bb774f8dc7b069ae7ecc2a1))
- node 16.16.0 ([641bb46](https://github.com/systembugtj/picasa-vue/commit/641bb467c0a435d3ddebad53ee1b833fed102b11))
- open in finder ([811a081](https://github.com/systembugtj/picasa-vue/commit/811a0812ffa78ab31e2d36d494eef5d2a6c46ef3))
- overlap issue ([82835ff](https://github.com/systembugtj/picasa-vue/commit/82835ffffb8b178b045378b39577671e69b5ceb1))
- package ([e8928f8](https://github.com/systembugtj/picasa-vue/commit/e8928f8af1b2448dd70d2a60286038ca0a8aaf5e))
- package-lock.json ([a78ff3d](https://github.com/systembugtj/picasa-vue/commit/a78ff3deff948acd2a13c83a19579c32fc8a5cf4))
- path handling ([e27d00f](https://github.com/systembugtj/picasa-vue/commit/e27d00f6ddc64c4d559c881eb2b08330ae970694))
- perf improvement for image list ([ac26901](https://github.com/systembugtj/picasa-vue/commit/ac269018426c625785019991e3ad0961a938c02a))
- perf of loading photasa config ([8d5e974](https://github.com/systembugtj/picasa-vue/commit/8d5e97484ca1d98f2e5a19ae0e16342db249a88b))
- photasa 配置存储队列修复 ([f86fa23](https://github.com/systembugtj/picasa-vue/commit/f86fa23955b14761968e003fd360327db93ee140))
- pr ([aec161e](https://github.com/systembugtj/picasa-vue/commit/aec161e3dea24b09b56d3b3e831afd67965d5101))
- preview didn't close issue, should handle onVisibleChange ([e544534](https://github.com/systembugtj/picasa-vue/commit/e5445349c1904bdccda93d2e09cb0f13d46246b5))
- preview name ([7a4d6e3](https://github.com/systembugtj/picasa-vue/commit/7a4d6e32f633b153e7d023d06275763f1f6b9ff4))
- preview original ([9a9e398](https://github.com/systembugtj/picasa-vue/commit/9a9e398d136282f6266b22a92799f5202578665a))
- queue folder to scan ([925c47b](https://github.com/systembugtj/picasa-vue/commit/925c47b2e1a8777fc32cdec15e81bba0cc69b778))
- read from cached file list ([708b0c7](https://github.com/systembugtj/picasa-vue/commit/708b0c7f43630961b46ca57e8063b0424ff7b9a3))
- refactor and unit test ([0fc9768](https://github.com/systembugtj/picasa-vue/commit/0fc976826f5097cb2459c1b617cb5b7430826661))
- remove bugsnag for windows ([159d4aa](https://github.com/systembugtj/picasa-vue/commit/159d4aa1bbb0dd7a5b08cfd1a83de0c1c991bf19))
- remove isVidoe check for prefetch ([8f48efd](https://github.com/systembugtj/picasa-vue/commit/8f48efdcbc3dc78b7f9a24f9d3ac4b31e2519596))
- remove isVidoe check for prefetch ([c4a65a5](https://github.com/systembugtj/picasa-vue/commit/c4a65a580fa258dc8a15eaff6391e5abdf5218bb))
- rename ([3ec4717](https://github.com/systembugtj/picasa-vue/commit/3ec4717f90d7577e94981c3d5cf81b368eda855d))
- reset ([1dd778a](https://github.com/systembugtj/picasa-vue/commit/1dd778ae9a0acc2aad0c75b7668c06a6eb0561ed))
- revert ([37f1634](https://github.com/systembugtj/picasa-vue/commit/37f1634ac32ed6e5e955aafce555942bba338e29))
- revert ([91b9237](https://github.com/systembugtj/picasa-vue/commit/91b9237d419a75c72f72b4304476a17e5d57abd4))
- revert again ([517a617](https://github.com/systembugtj/picasa-vue/commit/517a617b038cf5875557ed05bcd52f8a5e263fe1))
- revert build deletion ([06754c4](https://github.com/systembugtj/picasa-vue/commit/06754c4a404eb84776371a4f34d32fd3f663e545))
- save relative path to db ([1df6b45](https://github.com/systembugtj/picasa-vue/commit/1df6b453600f87d04da270a54d13e162bfd064e3))
- save treenode to preference ([ecc9b58](https://github.com/systembugtj/picasa-vue/commit/ecc9b58d2569a2da31ac8b4742cb3af37cef2825))
- set icon for all platforms ([c90a4a5](https://github.com/systembugtj/picasa-vue/commit/c90a4a5c30d450103950da100c1f8d8b87f2e385))
- show only visible ([28f4768](https://github.com/systembugtj/picasa-vue/commit/28f4768a9c58dbfae0b4d2828b29d30658f2bec9))
- show value in label ([b940899](https://github.com/systembugtj/picasa-vue/commit/b940899f41a0e18f348dd2f4f8f43edc93b44114))
- skip some tests ([4fbeb77](https://github.com/systembugtj/picasa-vue/commit/4fbeb775f823961bc6552409b115c77ef8abbe77))
- skip some tests ([d0a530e](https://github.com/systembugtj/picasa-vue/commit/d0a530ea92dec69ec45ac6e6b685677386e88b73))
- store for folder list ([632a3c6](https://github.com/systembugtj/picasa-vue/commit/632a3c67fc54f8b11f22903dd613217d2dc4b698))
- store for folder list ([cd95594](https://github.com/systembugtj/picasa-vue/commit/cd95594eede7e6a4befe8e689b51b156f37fd86d))
- sync original time ([d0e5f5a](https://github.com/systembugtj/picasa-vue/commit/d0e5f5a5d1c959c84149bc8feb6c204fe741d9ce))
- test ([ffa7772](https://github.com/systembugtj/picasa-vue/commit/ffa777266b5986eea827b47a1a04b8b071087082))
- test ([6481da8](https://github.com/systembugtj/picasa-vue/commit/6481da832271083452f2293afdd99517d732bef1))
- test ([7022d59](https://github.com/systembugtj/picasa-vue/commit/7022d59512eea6f047552b088fe0287e9c3e21e3))
- test ([77b2a0a](https://github.com/systembugtj/picasa-vue/commit/77b2a0a400eaddff095570317c4fdee642fdc445))
- test ([2b31dd2](https://github.com/systembugtj/picasa-vue/commit/2b31dd22789ba23ec44bd35f52c84572234660a7))
- test and doc ([97a65e8](https://github.com/systembugtj/picasa-vue/commit/97a65e892571820c85a9abd962d49e44358a9af9))
- test folder tree node ([ffd9cb2](https://github.com/systembugtj/picasa-vue/commit/ffd9cb25050e5b2597d1381276297c02418fc887))
- test import photos ([43a9d86](https://github.com/systembugtj/picasa-vue/commit/43a9d86d54d300c789fc89e733956daf27e321bf))
- testable ([6c4fde0](https://github.com/systembugtj/picasa-vue/commit/6c4fde0f6eea28c4d1011489cd62ffb7369c130c))
- tree handling ([781fb38](https://github.com/systembugtj/picasa-vue/commit/781fb38f46e2d506bc9b8dea365db57e55fc253b))
- typo ([3f83bce](https://github.com/systembugtj/picasa-vue/commit/3f83bcef23c55f01471cf9bb9729b8b4bad0f8dc))
- update build matrix ([25d6797](https://github.com/systembugtj/picasa-vue/commit/25d67974a017a3b8012964b5e2918c0cfeba1fd1))
- update build matrix ([1b00b07](https://github.com/systembugtj/picasa-vue/commit/1b00b0782a3e0d5a79bea63d130dace4803b772b))
- update dependencies glob to latest ([682030b](https://github.com/systembugtj/picasa-vue/commit/682030b5961e6e3911e67ea7d1f5aa1a60e10193))
- update dependencies glob to latest ([98b006e](https://github.com/systembugtj/picasa-vue/commit/98b006ec685b80f93ed9e83900c5d4275f9ded3b))
- update docs ([36f731b](https://github.com/systembugtj/picasa-vue/commit/36f731bfc9b463cc24858e09b5545f10f184288f))
- update eslint rules ([c26ceba](https://github.com/systembugtj/picasa-vue/commit/c26cebab84682aa81a4ffcc0d8de9eb11f1290fc))
- update locales ([af15d1b](https://github.com/systembugtj/picasa-vue/commit/af15d1b404c32ecd3addbbcd8eb534d69a2c1820))
- update scan-photos.ts to use @common/types for shared type imports ([ce5b583](https://github.com/systembugtj/picasa-vue/commit/ce5b583f9ee822ed750b7b5001b7d265899d2c3e))
- update scan-photos.ts to use @common/types for shared type imports ([f885f86](https://github.com/systembugtj/picasa-vue/commit/f885f864ca7bcdea651e93e42c2ff3d8ef2c3c4d))
- update UI ([f678e1b](https://github.com/systembugtj/picasa-vue/commit/f678e1b74097eb1ed6820ab572346d024614cc2a))
- update utils for windows path issue ([aac76f7](https://github.com/systembugtj/picasa-vue/commit/aac76f701fa74aa03cbfc1420b142a497673e6df))
- update utils for windows path issue ([31cc310](https://github.com/systembugtj/picasa-vue/commit/31cc3103acdb6e507c9a12e240d93b439d75edd8))
- use @common/types alias for VideoSize type in utils.ts (Vite compatibility) ([e63ed99](https://github.com/systembugtj/picasa-vue/commit/e63ed99c94791fbdb4fccd525ae060ad2698aac7))
- use heic-decode + sharp ([c7c8bbb](https://github.com/systembugtj/picasa-vue/commit/c7c8bbb9edf2bcce8f37eb695c9af37f91060a76))
- use heic2any instead of native libheif ([8994864](https://github.com/systembugtj/picasa-vue/commit/89948641e0a69e5980c646bcf2714a5a29b74372))
- use worker and refactor to service ([90ca32e](https://github.com/systembugtj/picasa-vue/commit/90ca32ee9bf17ee2ed0ba07bb55da7360f22e805))
- useTitle ([941a2ba](https://github.com/systembugtj/picasa-vue/commit/941a2ba515da98658028be792ede1fb93e907de1))
- version ([c5f1663](https://github.com/systembugtj/picasa-vue/commit/c5f1663cea3364b7767f7679fdf9de3afaceae2d))
- vitest.config.ts ([60a76c7](https://github.com/systembugtj/picasa-vue/commit/60a76c74db238bc7663dfa9d3c7944dff7a57547))
- watch deep ([34370b8](https://github.com/systembugtj/picasa-vue/commit/34370b89ffa5012c7b9b13c0c5ba746aa748f392))
- webSecurity for production ([c86d806](https://github.com/systembugtj/picasa-vue/commit/c86d8061adaaa9dcf2f256f1fd01c4d4635c7ba6))
- worker to save photasaconfig ([2fac5da](https://github.com/systembugtj/picasa-vue/commit/2fac5dae7ad0890bcd59d787072fffe693d15e11))
- yangshi ([b2d698b](https://github.com/systembugtj/picasa-vue/commit/b2d698bed8eb371d9f465b93f82c5cc32940029f))
- 修复依赖问题 ([c9d6bc3](https://github.com/systembugtj/picasa-vue/commit/c9d6bc3fef42bf36548d0461bb6467df0718fd65))

### Performance Improvements

- optimize file operations with batched reads and writes ([b725540](https://github.com/systembugtj/picasa-vue/commit/b7255408fb23b7f7dca4b20ac622603cfd7ed661))
- optimize image loading with increased concurrency and better loading states ([2fad6ec](https://github.com/systembugtj/picasa-vue/commit/2fad6ecc1f34dd501960cf5d8003b9dde9643a79))
