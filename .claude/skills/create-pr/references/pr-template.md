# PR 본문 템플릿

저장소 언어 판정 결과에 따라 아래 두 템플릿 중 하나만 쓴다. 빈 섹션은 헤더째 지운다.

## 한국어 템플릿

```markdown
## 요약
<이 PR이 무엇을, 왜 바꾸는지 1~3문장>

## 변경 사항
- <의미 단위로 묶은 변경 1>
- <변경 2>

## 테스트
- [ ] <실행한 검증 또는 리뷰어가 확인할 방법>

## 리뷰 포인트
<특히 봐주었으면 하는 부분, 트레이드오프. 없으면 이 섹션을 생략>

Closes #<이슈번호>   <!-- 있을 때만 -->
```

## 영문 템플릿

```markdown
## Summary
<1–3 sentences: what this PR changes and why>

## Changes
- <change 1, grouped by meaning>
- <change 2>

## Testing
- [ ] <checks you ran, or how a reviewer can verify>

## Notes for reviewers
<areas needing attention, trade-offs. Omit this section if none>

Closes #<issue>   <!-- only if applicable -->
```

## 작성 원칙

- "변경 사항"은 커밋 로그를 옮겨 적지 않고 의미 단위로 묶는다. 리뷰어는 `git log`로 커밋 목록을 이미 볼 수 있다.
- "테스트"에는 실제로 실행한 것만 체크(`[x]`)하고, 실행하지 않은 것은 `[ ]`로 남긴다. 돌리지 않은 검증을 통과한 것처럼 쓰면 리뷰어가 잘못된 신뢰를 갖게 된다.
- 코드 식별자·라이브러리명 같은 기술 용어는 어느 언어든 원문 그대로 둔다.
- 환경이 PR 본문 끝에 붙일 표기를 지정했다면 맨 아래에 그대로 붙인다. 지정이 없으면 만들어 붙이지 않는다.
